//! Admin authentication middleware
//!
//! Provides Bearer token authentication for admin endpoints.

use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::sync::Arc;
use tracing::{error, warn};

use crate::AppState;

/// Admin authentication error response
pub struct AdminAuthError {
    pub status: StatusCode,
    pub message: &'static str,
}

impl IntoResponse for AdminAuthError {
    fn into_response(self) -> Response {
        let body = serde_json::json!({
            "error": "authentication_failed",
            "message": self.message
        });

        (
            self.status,
            [("Content-Type", "application/json")],
            body.to_string(),
        )
            .into_response()
    }
}

/// Extract Bearer token from Authorization header
fn extract_bearer_token(auth_header: &str) -> Option<&str> {
    auth_header.strip_prefix("Bearer ")
}

/// Admin authentication middleware
///
/// Validates the Bearer token in the Authorization header against the configured admin API key.
/// Returns 401 Unauthorized if:
/// - Admin API is disabled
/// - Authorization header is missing
/// - Token format is invalid
/// - Token doesn't match the configured API key
pub async fn admin_auth_middleware(
    State(state): State<Arc<AppState>>,
    request: Request<Body>,
    next: Next,
) -> Response {
    // Check if admin API is enabled
    if !state.config.admin.enabled {
        warn!("Admin API access attempted but admin API is disabled");
        return AdminAuthError {
            status: StatusCode::FORBIDDEN,
            message: "Admin API is disabled",
        }
        .into_response();
    }

    // Check if API key is configured.
    // If admin is enabled but the key is empty, return the same 403 response
    // as the fully-disabled branch so attackers cannot distinguish the two
    // cases (no "Admin API key not configured" disclosure). Log loudly for
    // ops — this is a deploy-time misconfiguration that should be fixed.
    // `AppConfig::validate()` is expected to reject this at startup, so
    // reaching this branch in production indicates validation was bypassed.
    if state.config.admin.api_key.is_empty() {
        error!(
            "Admin API is enabled but ADMIN_API_KEY is empty. \
             Service will reject all admin requests with 403. \
             Check deploy environment variables."
        );
        return AdminAuthError {
            status: StatusCode::FORBIDDEN,
            message: "Admin API is disabled",
        }
        .into_response();
    }

    // Get Authorization header
    let auth_header = match request.headers().get("Authorization") {
        Some(header) => match header.to_str() {
            Ok(s) => s,
            Err(_) => {
                return AdminAuthError {
                    status: StatusCode::UNAUTHORIZED,
                    message: "Invalid Authorization header encoding",
                }
                .into_response();
            }
        },
        None => {
            return AdminAuthError {
                status: StatusCode::UNAUTHORIZED,
                message: "Missing Authorization header",
            }
            .into_response();
        }
    };

    // Extract Bearer token
    let token = match extract_bearer_token(auth_header) {
        Some(t) => t,
        None => {
            return AdminAuthError {
                status: StatusCode::UNAUTHORIZED,
                message: "Invalid Authorization header format. Expected: Bearer <token>",
            }
            .into_response();
        }
    };

    // Validate token using constant-time comparison to prevent timing attacks
    if !constant_time_compare(token.as_bytes(), state.config.admin.api_key.as_bytes()) {
        warn!("Admin API access attempted with invalid token");
        return AdminAuthError {
            status: StatusCode::UNAUTHORIZED,
            message: "Invalid API key",
        }
        .into_response();
    }

    // Token is valid, proceed with the request
    next.run(request).await
}

/// Constant-time string comparison to prevent timing attacks.
/// Always iterates over the longer slice to avoid leaking length info via timing.
fn constant_time_compare(a: &[u8], b: &[u8]) -> bool {
    let len_matches = a.len() == b.len();
    let max_len = a.len().max(b.len());

    let mut result = 0u8;
    for i in 0..max_len {
        let x = if i < a.len() { a[i] } else { 0 };
        let y = if i < b.len() { b[i] } else { 0 };
        result |= x ^ y;
    }
    result == 0 && len_matches
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_bearer_token_valid() {
        let token = extract_bearer_token("Bearer abc123");
        assert_eq!(token, Some("abc123"));
    }

    #[test]
    fn test_extract_bearer_token_no_bearer_prefix() {
        let token = extract_bearer_token("abc123");
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_bearer_token_lowercase_bearer() {
        let token = extract_bearer_token("bearer abc123");
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_bearer_token_empty() {
        let token = extract_bearer_token("");
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_bearer_token_only_bearer() {
        let token = extract_bearer_token("Bearer ");
        assert_eq!(token, Some(""));
    }

    #[test]
    fn test_extract_bearer_token_with_spaces() {
        let token = extract_bearer_token("Bearer token with spaces");
        assert_eq!(token, Some("token with spaces"));
    }

    #[test]
    fn test_constant_time_compare_equal() {
        assert!(constant_time_compare(b"secret", b"secret"));
    }

    #[test]
    fn test_constant_time_compare_different() {
        assert!(!constant_time_compare(b"secret", b"Secret"));
    }

    #[test]
    fn test_constant_time_compare_different_length() {
        assert!(!constant_time_compare(b"short", b"longer"));
    }

    #[test]
    fn test_constant_time_compare_empty() {
        assert!(constant_time_compare(b"", b""));
    }

    #[test]
    fn test_constant_time_compare_one_empty() {
        assert!(!constant_time_compare(b"secret", b""));
    }

    #[test]
    fn test_admin_auth_error_response() {
        let error = AdminAuthError {
            status: StatusCode::UNAUTHORIZED,
            message: "Test error",
        };
        let response = error.into_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn test_admin_auth_error_forbidden() {
        let error = AdminAuthError {
            status: StatusCode::FORBIDDEN,
            message: "Admin API disabled",
        };
        let response = error.into_response();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    // ========================================================================
    // Middleware integration tests — exercise every branch of
    // `admin_auth_middleware` end-to-end through an axum Router.
    // ========================================================================

    use crate::test_utils::{collect_body_str, test_app_state_with_config, test_config_with_admin};
    use axum::{
        body::Body,
        http::{HeaderValue, Request},
        middleware::from_fn_with_state,
        routing::get,
        Router,
    };
    use tower::ServiceExt;

    /// Build a minimal router with a single protected route, wired through
    /// `admin_auth_middleware` with the provided admin config. Returns a
    /// fully-constructed `Router<()>` ready for `oneshot`.
    async fn protected_router(enabled: bool, api_key: &str) -> Router {
        let state = test_app_state_with_config(test_config_with_admin(enabled, api_key)).await;
        Router::new()
            .route("/protected", get(|| async { "ok" }))
            .layer(from_fn_with_state(state.clone(), admin_auth_middleware))
            .with_state(state)
    }

    #[tokio::test]
    async fn admin_auth_middleware_rejects_when_admin_disabled_with_403() {
        let app = protected_router(false, "").await;
        let req = Request::builder()
            .uri("/protected")
            .body(Body::empty())
            .expect("valid request");

        let resp = app.oneshot(req).await.expect("router call");
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
        let body = collect_body_str(resp).await;
        assert!(
            body.contains("Admin API is disabled"),
            "body should use disabled message, got: {body}"
        );
    }

    #[tokio::test]
    async fn admin_auth_middleware_rejects_empty_api_key_with_403_not_500_f4_regression() {
        // F4 regression: previously returned 500 + "Admin API key not configured",
        // leaking the fact that admin was enabled but misconfigured. Must now
        // return the same 403 + "Admin API is disabled" as the disabled branch.
        let app = protected_router(true, "").await;
        let req = Request::builder()
            .uri("/protected")
            .header("Authorization", "Bearer anything")
            .body(Body::empty())
            .expect("valid request");

        let resp = app.oneshot(req).await.expect("router call");
        assert_eq!(
            resp.status(),
            StatusCode::FORBIDDEN,
            "must return 403, not 500 — see F4"
        );
        let body = collect_body_str(resp).await;
        assert!(
            body.contains("Admin API is disabled"),
            "must surface disabled-style message, got: {body}"
        );
        assert!(
            !body.contains("not configured"),
            "must NOT disclose misconfiguration, got: {body}"
        );
    }

    #[tokio::test]
    async fn admin_auth_middleware_rejects_missing_authorization_header_with_401() {
        let app = protected_router(true, "correct-key").await;
        let req = Request::builder()
            .uri("/protected")
            .body(Body::empty())
            .expect("valid request");

        let resp = app.oneshot(req).await.expect("router call");
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
        let body = collect_body_str(resp).await;
        assert!(
            body.contains("Missing Authorization header"),
            "body: {body}"
        );
    }

    #[tokio::test]
    async fn admin_auth_middleware_rejects_non_utf8_authorization_header_with_401() {
        let app = protected_router(true, "correct-key").await;
        // HeaderValue with non-ASCII/non-UTF8 bytes fails `to_str()`.
        let bad = HeaderValue::from_bytes(&[0xff, 0xfe, 0xfd]).expect("valid header bytes");
        let req = Request::builder()
            .uri("/protected")
            .header("Authorization", bad)
            .body(Body::empty())
            .expect("valid request");

        let resp = app.oneshot(req).await.expect("router call");
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
        let body = collect_body_str(resp).await;
        assert!(
            body.contains("Invalid Authorization header encoding"),
            "body: {body}"
        );
    }

    #[tokio::test]
    async fn admin_auth_middleware_rejects_wrong_format_header_with_401() {
        let app = protected_router(true, "correct-key").await;
        let req = Request::builder()
            .uri("/protected")
            .header("Authorization", "Basic xyz")
            .body(Body::empty())
            .expect("valid request");

        let resp = app.oneshot(req).await.expect("router call");
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
        let body = collect_body_str(resp).await;
        assert!(
            body.contains("Invalid Authorization header format"),
            "body: {body}"
        );
    }

    #[tokio::test]
    async fn admin_auth_middleware_rejects_wrong_token_with_401() {
        let app = protected_router(true, "correct").await;
        let req = Request::builder()
            .uri("/protected")
            .header("Authorization", "Bearer wrong")
            .body(Body::empty())
            .expect("valid request");

        let resp = app.oneshot(req).await.expect("router call");
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
        let body = collect_body_str(resp).await;
        assert!(body.contains("Invalid API key"), "body: {body}");
    }

    #[tokio::test]
    async fn admin_auth_middleware_allows_correct_bearer_token_with_200() {
        let app = protected_router(true, "correct").await;
        let req = Request::builder()
            .uri("/protected")
            .header("Authorization", "Bearer correct")
            .body(Body::empty())
            .expect("valid request");

        let resp = app.oneshot(req).await.expect("router call");
        assert_eq!(resp.status(), StatusCode::OK);
        let body = collect_body_str(resp).await;
        assert_eq!(body, "ok");
    }

    #[tokio::test]
    async fn admin_auth_middleware_does_not_disclose_misconfig_in_response_body_f4() {
        // Hardened assertion: even with a seemingly-plausible auth header,
        // the empty-api-key branch must not hint at the misconfiguration.
        let app = protected_router(true, "").await;
        let req = Request::builder()
            .uri("/protected")
            .header("Authorization", "Bearer some-token")
            .body(Body::empty())
            .expect("valid request");

        let resp = app.oneshot(req).await.expect("router call");
        let body = collect_body_str(resp).await.to_lowercase();
        assert!(
            !body.contains("not configured"),
            "body must not disclose misconfig ('not configured'), got: {body}"
        );
        assert!(
            !body.contains("api_key"),
            "body must not mention api_key internals, got: {body}"
        );
    }
}
