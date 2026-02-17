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
use tracing::warn;

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

    // Check if API key is configured
    if state.config.admin.api_key.is_empty() {
        warn!("Admin API access attempted but no API key is configured");
        return AdminAuthError {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: "Admin API key not configured",
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

/// Constant-time string comparison to prevent timing attacks
fn constant_time_compare(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }

    let mut result = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        result |= x ^ y;
    }
    result == 0
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
}
