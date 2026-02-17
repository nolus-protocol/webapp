//! Rate limiting middleware for the API
//!
//! Provides configurable rate limiting based on client IP address.
//! Uses the token bucket algorithm via the `governor` crate.

use axum::{
    body::Body,
    extract::ConnectInfo,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use governor::{
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};
use std::{
    collections::HashMap,
    net::{IpAddr, SocketAddr},
    num::NonZeroU32,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, OnceLock,
    },
    time::{Duration, Instant},
};
use tokio::sync::RwLock;
use tracing::{debug, warn};

/// Monotonic epoch for converting `Instant` to/from `AtomicU64`.
/// Using a process-level epoch avoids overflow for any reasonable uptime.
fn epoch() -> Instant {
    static EPOCH: OnceLock<Instant> = OnceLock::new();
    *EPOCH.get_or_init(Instant::now)
}

/// Configuration for rate limiting
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Maximum requests per window
    pub requests_per_second: u32,
    /// Burst size (max tokens that can accumulate)
    pub burst_size: u32,
    /// Enable rate limiting
    pub enabled: bool,
    /// Whitelist of IPs that bypass rate limiting
    pub whitelist: Vec<IpAddr>,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            requests_per_second: 10,
            burst_size: 20,
            enabled: true,
            whitelist: vec![],
        }
    }
}

/// Type alias for the rate limiter type to reduce complexity
type IpRateLimiter = Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>;

/// Per-IP entry: token-bucket limiter + atomic last-access timestamp.
/// The timestamp is stored as milliseconds since process epoch so it can be
/// updated with a single atomic store (no write lock needed on the hot path).
struct IpEntry {
    limiter: IpRateLimiter,
    last_access_ms: AtomicU64,
}

impl IpEntry {
    fn new(limiter: IpRateLimiter) -> Self {
        let ms = epoch().elapsed().as_millis() as u64;
        Self {
            limiter,
            last_access_ms: AtomicU64::new(ms),
        }
    }

    fn touch(&self) {
        let ms = epoch().elapsed().as_millis() as u64;
        self.last_access_ms.store(ms, Ordering::Relaxed);
    }

    fn last_access(&self) -> Duration {
        Duration::from_millis(self.last_access_ms.load(Ordering::Relaxed))
    }
}

/// Rate limiter state shared across requests
pub struct RateLimitState {
    config: RateLimitConfig,
    /// Per-IP rate limiters with atomic last-access timestamps.
    /// Read lock: check existing limiter + atomic timestamp update (hot path).
    /// Write lock: insert new IP or evict stale entries (cold path).
    limiters: RwLock<HashMap<IpAddr, Arc<IpEntry>>>,
}

impl RateLimitState {
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            config,
            limiters: RwLock::new(HashMap::new()),
        }
    }

    /// Check if the given IP is rate limited.
    /// Hot path (known IP): read lock only + atomic store.
    pub async fn check_rate_limit(&self, ip: IpAddr) -> bool {
        if !self.config.enabled {
            return true;
        }

        if self.config.whitelist.contains(&ip) {
            return true;
        }

        // Fast path: read lock for known IPs
        let entry = {
            let limiters = self.limiters.read().await;
            limiters.get(&ip).cloned()
        };

        if let Some(entry) = entry {
            entry.touch();
            return entry.limiter.check().is_ok();
        }

        // Slow path: write lock for new IPs
        let mut limiters = self.limiters.write().await;

        // Double-check after acquiring write lock
        if let Some(entry) = limiters.get(&ip) {
            entry.touch();
            return entry.limiter.check().is_ok();
        }

        let quota = Quota::per_second(
            NonZeroU32::new(self.config.requests_per_second).unwrap_or(NonZeroU32::MIN),
        )
        .allow_burst(NonZeroU32::new(self.config.burst_size).unwrap_or(NonZeroU32::MIN));

        let limiter = Arc::new(RateLimiter::direct(quota));
        let result = limiter.check().is_ok();
        limiters.insert(ip, Arc::new(IpEntry::new(limiter)));
        result
    }

    /// Remove entries that haven't been accessed within `max_age`
    pub async fn cleanup_stale(&self, max_age: Duration) {
        let now = epoch().elapsed();
        let max_age_ms = max_age.as_millis() as u64;
        let mut limiters = self.limiters.write().await;
        let before = limiters.len();
        limiters.retain(|_, entry| {
            let age_ms = now
                .as_millis()
                .saturating_sub(entry.last_access().as_millis()) as u64;
            age_ms < max_age_ms
        });
        let removed = before - limiters.len();
        if removed > 0 {
            debug!(
                "Rate limiter cleanup: removed {} stale entries, {} remaining",
                removed,
                limiters.len()
            );
        }
    }
}

/// Start a background task that periodically evicts stale rate limiter entries
pub fn start_cleanup_task(state: Arc<RateLimitState>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300)); // 5 minutes
        let max_age = Duration::from_secs(600); // 10 minutes
        loop {
            interval.tick().await;
            state.cleanup_stale(max_age).await;
        }
    });
}

/// Extract client IP from request
fn extract_client_ip<B>(
    req: &Request<B>,
    connect_info: Option<&ConnectInfo<SocketAddr>>,
) -> Option<IpAddr> {
    // Try X-Forwarded-For header first (for reverse proxy setups)
    if let Some(forwarded) = req.headers().get("x-forwarded-for") {
        if let Ok(forwarded_str) = forwarded.to_str() {
            // Take the first IP in the chain (original client)
            if let Some(first_ip) = forwarded_str.split(',').next() {
                if let Ok(ip) = first_ip.trim().parse::<IpAddr>() {
                    return Some(ip);
                }
            }
        }
    }

    // Try X-Real-IP header
    if let Some(real_ip) = req.headers().get("x-real-ip") {
        if let Ok(ip_str) = real_ip.to_str() {
            if let Ok(ip) = ip_str.trim().parse::<IpAddr>() {
                return Some(ip);
            }
        }
    }

    // Fall back to connection info
    connect_info.map(|ci| ci.0.ip())
}

/// Rate limiting middleware
pub async fn rate_limit_middleware(
    state: Arc<RateLimitState>,
    connect_info: Option<ConnectInfo<SocketAddr>>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let client_ip = extract_client_ip(&request, connect_info.as_ref());

    if let Some(ip) = client_ip {
        if !state.check_rate_limit(ip).await {
            warn!("Rate limit exceeded for IP: {}", ip);
            return RateLimitExceeded.into_response();
        }
    }

    next.run(request).await
}

/// Response returned when rate limit is exceeded
pub struct RateLimitExceeded;

impl IntoResponse for RateLimitExceeded {
    fn into_response(self) -> Response {
        let body = serde_json::json!({
            "error": "rate_limit_exceeded",
            "message": "Too many requests. Please try again later.",
            "retry_after_seconds": 1
        });

        (
            StatusCode::TOO_MANY_REQUESTS,
            [("Content-Type", "application/json"), ("Retry-After", "1")],
            body.to_string(),
        )
            .into_response()
    }
}

/// Create rate limit layer for specific routes
pub fn create_rate_limit_state(config: RateLimitConfig) -> Arc<RateLimitState> {
    Arc::new(RateLimitState::new(config))
}

/// Stricter rate limit for sensitive endpoints (e.g., write operations)
pub fn strict_rate_limit_config() -> RateLimitConfig {
    RateLimitConfig {
        requests_per_second: 2,
        burst_size: 5,
        enabled: true,
        whitelist: vec![],
    }
}

/// Standard rate limit for read operations
pub fn standard_rate_limit_config() -> RateLimitConfig {
    RateLimitConfig {
        requests_per_second: 20,
        burst_size: 50,
        enabled: true,
        whitelist: vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{Ipv4Addr, Ipv6Addr};

    #[test]
    fn test_rate_limit_config_default() {
        let config = RateLimitConfig::default();
        assert_eq!(config.requests_per_second, 10);
        assert_eq!(config.burst_size, 20);
        assert!(config.enabled);
        assert!(config.whitelist.is_empty());
    }

    #[test]
    fn test_strict_rate_limit_config() {
        let config = strict_rate_limit_config();
        assert_eq!(config.requests_per_second, 2);
        assert_eq!(config.burst_size, 5);
    }

    #[test]
    fn test_standard_rate_limit_config() {
        let config = standard_rate_limit_config();
        assert_eq!(config.requests_per_second, 20);
        assert_eq!(config.burst_size, 50);
    }

    #[tokio::test]
    async fn test_rate_limit_state_new() {
        let config = RateLimitConfig::default();
        let _state = RateLimitState::new(config);
        // State is created successfully
    }

    #[tokio::test]
    async fn test_rate_limit_disabled() {
        let config = RateLimitConfig {
            enabled: false,
            ..Default::default()
        };
        let state = RateLimitState::new(config);
        let ip: IpAddr = Ipv4Addr::new(192, 168, 1, 1).into();

        // Should always allow when disabled
        for _ in 0..100 {
            assert!(state.check_rate_limit(ip).await);
        }
    }

    #[tokio::test]
    async fn test_rate_limit_whitelist() {
        let whitelisted_ip: IpAddr = Ipv4Addr::new(10, 0, 0, 1).into();
        let config = RateLimitConfig {
            requests_per_second: 1,
            burst_size: 1,
            enabled: true,
            whitelist: vec![whitelisted_ip],
        };
        let state = RateLimitState::new(config);

        // Whitelisted IP should always pass
        for _ in 0..100 {
            assert!(state.check_rate_limit(whitelisted_ip).await);
        }
    }

    #[tokio::test]
    async fn test_rate_limit_enforcement() {
        let config = RateLimitConfig {
            requests_per_second: 1,
            burst_size: 2,
            enabled: true,
            whitelist: vec![],
        };
        let state = RateLimitState::new(config);
        let ip: IpAddr = Ipv4Addr::new(192, 168, 1, 100).into();

        // First two requests should succeed (burst)
        assert!(state.check_rate_limit(ip).await);
        assert!(state.check_rate_limit(ip).await);

        // Third request should be limited
        assert!(!state.check_rate_limit(ip).await);
    }

    #[tokio::test]
    async fn test_rate_limit_per_ip_isolation() {
        let config = RateLimitConfig {
            requests_per_second: 1,
            burst_size: 1,
            enabled: true,
            whitelist: vec![],
        };
        let state = RateLimitState::new(config);

        let ip1: IpAddr = Ipv4Addr::new(192, 168, 1, 1).into();
        let ip2: IpAddr = Ipv4Addr::new(192, 168, 1, 2).into();

        // Each IP gets its own limit
        assert!(state.check_rate_limit(ip1).await);
        assert!(state.check_rate_limit(ip2).await);

        // First IPs are now limited
        assert!(!state.check_rate_limit(ip1).await);
        assert!(!state.check_rate_limit(ip2).await);
    }

    #[tokio::test]
    async fn test_rate_limit_ipv6() {
        let config = RateLimitConfig {
            requests_per_second: 1,
            burst_size: 1,
            enabled: true,
            whitelist: vec![],
        };
        let state = RateLimitState::new(config);
        let ipv6: IpAddr = Ipv6Addr::new(0x2001, 0xdb8, 0, 0, 0, 0, 0, 1).into();

        assert!(state.check_rate_limit(ipv6).await);
        assert!(!state.check_rate_limit(ipv6).await);
    }

    #[test]
    fn test_rate_limit_exceeded_response() {
        let response = RateLimitExceeded.into_response();
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    }

    #[test]
    fn test_create_rate_limit_state() {
        let config = RateLimitConfig::default();
        let state = create_rate_limit_state(config);
        assert!(state.config.enabled);
    }

    #[test]
    fn test_rate_limit_config_clone() {
        let config = RateLimitConfig {
            requests_per_second: 5,
            burst_size: 10,
            enabled: true,
            whitelist: vec![Ipv4Addr::new(127, 0, 0, 1).into()],
        };
        let cloned = config.clone();
        assert_eq!(cloned.requests_per_second, 5);
        assert_eq!(cloned.whitelist.len(), 1);
    }

    #[tokio::test]
    async fn test_cleanup_stale_evicts_old_entries() {
        let config = RateLimitConfig {
            requests_per_second: 10,
            burst_size: 10,
            enabled: true,
            whitelist: vec![],
        };
        let state = RateLimitState::new(config);

        let ip1: IpAddr = Ipv4Addr::new(10, 0, 0, 1).into();
        let ip2: IpAddr = Ipv4Addr::new(10, 0, 0, 2).into();

        // Create entries for both IPs
        state.check_rate_limit(ip1).await;
        state.check_rate_limit(ip2).await;
        assert_eq!(state.limiters.read().await.len(), 2);

        // Cleanup with zero max age evicts everything
        state.cleanup_stale(Duration::ZERO).await;
        assert_eq!(state.limiters.read().await.len(), 0);

        // Re-create ip2 only, then touch ip1 so it's fresh
        state.check_rate_limit(ip1).await;
        // Small sleep so ip1 ages a tiny bit, then add ip2 which is newer
        tokio::time::sleep(tokio::time::Duration::from_millis(20)).await;
        state.check_rate_limit(ip2).await;
        assert_eq!(state.limiters.read().await.len(), 2);

        // Cleanup with 10ms max age — ip1 (>20ms old) should be evicted, ip2 (fresh) kept
        state.cleanup_stale(Duration::from_millis(10)).await;

        let limiters = state.limiters.read().await;
        assert_eq!(limiters.len(), 1);
        assert!(limiters.contains_key(&ip2));
        assert!(!limiters.contains_key(&ip1));
    }

    #[tokio::test]
    async fn test_cleanup_keeps_fresh_entries() {
        let config = RateLimitConfig {
            requests_per_second: 10,
            burst_size: 10,
            enabled: true,
            whitelist: vec![],
        };
        let state = RateLimitState::new(config);

        let ip: IpAddr = Ipv4Addr::new(10, 0, 0, 1).into();
        state.check_rate_limit(ip).await;

        // Cleanup with a generous max age — entry should survive
        state.cleanup_stale(Duration::from_secs(600)).await;

        assert_eq!(state.limiters.read().await.len(), 1);
    }
}
