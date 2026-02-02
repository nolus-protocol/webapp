//! Performance benchmarks for the Nolus backend
//!
//! Run with: cargo bench
//!
//! These benchmarks measure the performance of critical paths:
//! - JSON serialization/deserialization
//! - Cache operations
//! - Rate limiting checks
//! - Response building

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr};
use std::sync::Arc;
use tokio::runtime::Runtime;

// Benchmark JSON serialization of typical response types
mod serialization_benchmarks {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct PriceResponse {
        ticker: String,
        price: String,
        timestamp: u64,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct BalanceResponse {
        denom: String,
        amount: String,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct LeaseResponse {
        address: String,
        owner: String,
        status: String,
        principal: String,
        interest: String,
        collateral: Vec<BalanceResponse>,
        debt: Vec<BalanceResponse>,
    }

    pub fn benchmark_price_serialization(c: &mut Criterion) {
        let prices: Vec<PriceResponse> = (0..100)
            .map(|i| PriceResponse {
                ticker: format!("TOKEN{}", i),
                price: "1.234567890123456789".to_string(),
                timestamp: 1700000000 + i,
            })
            .collect();

        c.bench_function("serialize_100_prices", |b| {
            b.iter(|| serde_json::to_string(black_box(&prices)).unwrap())
        });
    }

    pub fn benchmark_price_deserialization(c: &mut Criterion) {
        let prices: Vec<PriceResponse> = (0..100)
            .map(|i| PriceResponse {
                ticker: format!("TOKEN{}", i),
                price: "1.234567890123456789".to_string(),
                timestamp: 1700000000 + i,
            })
            .collect();
        let json = serde_json::to_string(&prices).unwrap();

        c.bench_function("deserialize_100_prices", |b| {
            b.iter(|| serde_json::from_str::<Vec<PriceResponse>>(black_box(&json)).unwrap())
        });
    }

    pub fn benchmark_lease_serialization(c: &mut Criterion) {
        let leases: Vec<LeaseResponse> = (0..50)
            .map(|i| LeaseResponse {
                address: format!("nolus1lease{:040}", i),
                owner: format!("nolus1owner{:040}", i),
                status: "opened".to_string(),
                principal: "1000000000".to_string(),
                interest: "50000000".to_string(),
                collateral: vec![
                    BalanceResponse {
                        denom: "unls".to_string(),
                        amount: "500000000".to_string(),
                    },
                    BalanceResponse {
                        denom: "uatom".to_string(),
                        amount: "100000000".to_string(),
                    },
                ],
                debt: vec![BalanceResponse {
                    denom: "uusdc".to_string(),
                    amount: "1050000000".to_string(),
                }],
            })
            .collect();

        c.bench_function("serialize_50_leases", |b| {
            b.iter(|| serde_json::to_string(black_box(&leases)).unwrap())
        });
    }

    pub fn benchmark_hashmap_prices(c: &mut Criterion) {
        let mut group = c.benchmark_group("price_map_operations");

        for size in [10, 50, 100, 500].iter() {
            let prices: HashMap<String, String> = (0..*size)
                .map(|i| (format!("TOKEN{}", i), "1.234567890".to_string()))
                .collect();

            group.bench_with_input(BenchmarkId::new("serialize", size), &prices, |b, prices| {
                b.iter(|| serde_json::to_string(black_box(prices)).unwrap())
            });

            let json = serde_json::to_string(&prices).unwrap();
            group.bench_with_input(BenchmarkId::new("deserialize", size), &json, |b, json| {
                b.iter(|| serde_json::from_str::<HashMap<String, String>>(black_box(json)).unwrap())
            });
        }

        group.finish();
    }
}

// Benchmark cache operations
mod cache_benchmarks {
    use super::*;
    use moka::future::Cache;
    use std::time::Duration;

    pub fn benchmark_cache_operations(c: &mut Criterion) {
        let rt = Runtime::new().unwrap();

        let cache: Cache<String, String> = Cache::builder()
            .max_capacity(10000)
            .time_to_live(Duration::from_secs(300))
            .build();

        // Pre-populate cache
        for i in 0..1000 {
            let key = format!("key_{}", i);
            let value = format!("value_{}", i);
            rt.block_on(cache.insert(key, value));
        }

        c.bench_function("cache_get_hit", |b| {
            b.to_async(&rt)
                .iter(|| async { black_box(cache.get(&"key_500".to_string()).await) })
        });

        c.bench_function("cache_get_miss", |b| {
            b.to_async(&rt)
                .iter(|| async { black_box(cache.get(&"nonexistent_key".to_string()).await) })
        });

        c.bench_function("cache_insert", |b| {
            let mut counter = 0u64;
            b.to_async(&rt).iter(|| {
                counter += 1;
                let key = format!("new_key_{}", counter);
                let value = format!("new_value_{}", counter);
                let cache = cache.clone();
                async move {
                    cache.insert(key, value).await;
                }
            })
        });
    }

    pub fn benchmark_cache_concurrent_access(c: &mut Criterion) {
        let rt = Runtime::new().unwrap();

        let cache: Arc<Cache<String, String>> = Arc::new(
            Cache::builder()
                .max_capacity(10000)
                .time_to_live(Duration::from_secs(300))
                .build(),
        );

        // Pre-populate
        for i in 0..1000 {
            rt.block_on(cache.insert(format!("key_{}", i), format!("value_{}", i)));
        }

        c.bench_function("cache_concurrent_reads", |b| {
            b.to_async(&rt).iter(|| {
                let cache = cache.clone();
                async move {
                    let handles: Vec<_> = (0..10)
                        .map(|i| {
                            let cache = cache.clone();
                            let key = format!("key_{}", i * 100);
                            tokio::spawn(async move { cache.get(&key).await })
                        })
                        .collect();

                    for handle in handles {
                        black_box(handle.await.unwrap());
                    }
                }
            })
        });
    }
}

// Benchmark rate limiting
mod rate_limit_benchmarks {
    use super::*;
    use governor::{
        clock::DefaultClock,
        state::{InMemoryState, NotKeyed},
        Quota, RateLimiter,
    };
    use std::num::NonZeroU32;

    pub fn benchmark_rate_limiter_check(c: &mut Criterion) {
        let quota = Quota::per_second(NonZeroU32::new(100).unwrap())
            .allow_burst(NonZeroU32::new(200).unwrap());
        let limiter = RateLimiter::<NotKeyed, InMemoryState, DefaultClock>::direct(quota);

        c.bench_function("rate_limiter_check_allowed", |b| {
            b.iter(|| {
                // Reset by creating new limiter each iteration for consistent measurement
                let quota = Quota::per_second(NonZeroU32::new(100).unwrap())
                    .allow_burst(NonZeroU32::new(200).unwrap());
                let limiter = RateLimiter::<NotKeyed, InMemoryState, DefaultClock>::direct(quota);
                black_box(limiter.check().is_ok())
            })
        });

        // Exhaust the limiter first
        for _ in 0..200 {
            let _ = limiter.check();
        }

        c.bench_function("rate_limiter_check_denied", |b| {
            b.iter(|| black_box(limiter.check().is_err()))
        });
    }

    pub fn benchmark_ip_lookup(c: &mut Criterion) {
        let rt = Runtime::new().unwrap();

        use tokio::sync::RwLock;

        let limiters: Arc<RwLock<HashMap<IpAddr, u32>>> = Arc::new(RwLock::new(HashMap::new()));

        // Pre-populate with 1000 IPs
        rt.block_on(async {
            let mut map = limiters.write().await;
            for i in 0..1000u32 {
                let ip: IpAddr = Ipv4Addr::new(
                    ((i >> 24) & 0xFF) as u8,
                    ((i >> 16) & 0xFF) as u8,
                    ((i >> 8) & 0xFF) as u8,
                    (i & 0xFF) as u8,
                )
                .into();
                map.insert(ip, i);
            }
        });

        let test_ip: IpAddr = Ipv4Addr::new(0, 0, 1, 244).into(); // IP 500

        c.bench_function("ip_rate_limiter_lookup", |b| {
            b.to_async(&rt).iter(|| {
                let limiters = limiters.clone();
                async move {
                    let map = limiters.read().await;
                    black_box(map.get(&test_ip))
                }
            })
        });
    }
}

// Benchmark address validation
mod validation_benchmarks {
    use super::*;

    fn is_valid_bech32_address(address: &str, prefix: &str) -> bool {
        if !address.starts_with(prefix) {
            return false;
        }

        // Simple length check for Cosmos addresses
        address.len() >= 39
            && address.len() <= 65
            && address.chars().all(|c| c.is_ascii_alphanumeric())
    }

    pub fn benchmark_address_validation(c: &mut Criterion) {
        let valid_address = "nolus1gurgpv8savnfw66lckwzn4zk7fp394lpe667dhu7aw48u40lj6jsqxf8nd";
        let invalid_address = "invalid_address";

        c.bench_function("validate_address_valid", |b| {
            b.iter(|| black_box(is_valid_bech32_address(black_box(valid_address), "nolus")))
        });

        c.bench_function("validate_address_invalid", |b| {
            b.iter(|| black_box(is_valid_bech32_address(black_box(invalid_address), "nolus")))
        });
    }
}

// Benchmark string operations common in the codebase
mod string_benchmarks {
    use super::*;

    pub fn benchmark_string_formatting(c: &mut Criterion) {
        c.bench_function("format_api_url", |b| {
            let base_url = "https://api.example.com";
            let endpoint = "/v1/prices";
            let param = "ticker=NLS";

            b.iter(|| black_box(format!("{}{}?{}", base_url, endpoint, param)))
        });

        c.bench_function("format_cache_key", |b| {
            let prefix = "prices";
            let protocol = "OSMOSIS-OSMOSIS-USDC_NOBLE";
            let address = "nolus1abc123";

            b.iter(|| black_box(format!("{}:{}:{}", prefix, protocol, address)))
        });
    }

    pub fn benchmark_base64_encoding(c: &mut Criterion) {
        use base64::Engine;

        let query = serde_json::json!({
            "prices": {
                "currencies": ["NLS", "ATOM", "OSMO"]
            }
        });
        let query_bytes = serde_json::to_vec(&query).unwrap();

        c.bench_function("base64_encode_query", |b| {
            b.iter(|| {
                black_box(base64::engine::general_purpose::STANDARD.encode(black_box(&query_bytes)))
            })
        });

        let encoded = base64::engine::general_purpose::STANDARD.encode(&query_bytes);
        c.bench_function("base64_decode_query", |b| {
            b.iter(|| {
                black_box(
                    base64::engine::general_purpose::STANDARD
                        .decode(black_box(&encoded))
                        .unwrap(),
                )
            })
        });
    }
}

criterion_group!(
    benches,
    serialization_benchmarks::benchmark_price_serialization,
    serialization_benchmarks::benchmark_price_deserialization,
    serialization_benchmarks::benchmark_lease_serialization,
    serialization_benchmarks::benchmark_hashmap_prices,
    cache_benchmarks::benchmark_cache_operations,
    cache_benchmarks::benchmark_cache_concurrent_access,
    rate_limit_benchmarks::benchmark_rate_limiter_check,
    rate_limit_benchmarks::benchmark_ip_lookup,
    validation_benchmarks::benchmark_address_validation,
    string_benchmarks::benchmark_string_formatting,
    string_benchmarks::benchmark_base64_encoding,
);

criterion_main!(benches);
