use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

/// Application error types
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Validation failed: {message}")]
    Validation {
        message: String,
        field: Option<String>,
        details: Option<serde_json::Value>,
    },

    #[error("Resource not found: {resource}")]
    NotFound { resource: String },

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Forbidden")]
    Forbidden,

    #[error("Rate limited")]
    RateLimited { retry_after: Option<u64> },

    #[error("External API error: {api} - {message}")]
    ExternalApi { api: String, message: String },

    #[error("Chain RPC error: {chain} - {message}")]
    ChainRpc { chain: String, message: String },

    #[error("Swap route failed: {message}")]
    SwapRouteFailed { message: String },

    #[error("Service unavailable: {message}")]
    ServiceUnavailable { message: String },

    #[error("Internal error: {0}")]
    Internal(String),
}

/// Error response body
#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorResponse {
    pub error: ErrorBody,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorBody {
    /// Machine-readable error code (e.g. `VALIDATION_FAILED`, `NOT_FOUND`).
    pub code: String,
    /// Human-readable message.
    pub message: String,
    /// Field name that failed validation (when applicable).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    /// Additional structured details about the error.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub details: Option<serde_json::Value>,
    /// Number of seconds the client should wait before retrying (rate-limit responses).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after: Option<u64>,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message, field, details, retry_after) = match &self {
            AppError::Validation {
                message,
                field,
                details,
            } => (
                StatusCode::BAD_REQUEST,
                "VALIDATION_FAILED",
                message.clone(),
                field.clone(),
                details.clone(),
                None,
            ),
            AppError::NotFound { resource } => (
                StatusCode::NOT_FOUND,
                "NOT_FOUND",
                format!("{} not found", resource),
                None,
                None,
                None,
            ),
            AppError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "UNAUTHORIZED",
                "Authentication required".to_string(),
                None,
                None,
                None,
            ),
            AppError::Forbidden => (
                StatusCode::FORBIDDEN,
                "FORBIDDEN",
                "Insufficient permissions".to_string(),
                None,
                None,
                None,
            ),
            AppError::RateLimited { retry_after } => (
                StatusCode::TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "Too many requests".to_string(),
                None,
                None,
                *retry_after,
            ),
            AppError::ExternalApi { api, message } => (
                StatusCode::BAD_GATEWAY,
                "EXTERNAL_SERVICE_ERROR",
                format!("{}: {}", api, message),
                None,
                None,
                None,
            ),
            AppError::ChainRpc { chain, message } => (
                StatusCode::BAD_GATEWAY,
                "CHAIN_ERROR",
                format!("{}: {}", chain, message),
                None,
                None,
                None,
            ),
            AppError::SwapRouteFailed { message } => (
                StatusCode::BAD_GATEWAY,
                "SWAP_ROUTE_FAILED",
                message.clone(),
                None,
                None,
                None,
            ),
            AppError::ServiceUnavailable { message } => (
                StatusCode::SERVICE_UNAVAILABLE,
                "SERVICE_UNAVAILABLE",
                message.clone(),
                None,
                None,
                None,
            ),
            AppError::Internal(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                msg.clone(),
                None,
                None,
                None,
            ),
        };

        let body = ErrorResponse {
            error: ErrorBody {
                code: code.to_string(),
                message,
                field,
                details,
                retry_after,
            },
        };

        (status, Json(body)).into_response()
    }
}

// Convenience conversion from anyhow::Error
impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Internal(err.to_string())
    }
}

// Convenience conversion from reqwest errors
impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::ExternalApi {
            api: "HTTP".to_string(),
            message: err.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    //! Pin the current behavior of `AppError` → HTTP response mapping.
    //!
    //! Phase 2 scope note: the user VETOED sanitizing
    //! `Internal` / `ExternalApi` / `ChainRpc` response bodies. Detailed
    //! error text is intentionally preserved so that (a) users see what
    //! went wrong and (b) debugging is faster. These tests lock that
    //! contract in place — an accidental future sanitization will fail CI.
    //!
    //! Envelope shape (confirmed from `IntoResponse` impl above):
    //! `{ "error": { "code": "<CODE>", "message": "<msg>", "field"?, "details"?, "retry_after"? } }`
    //! — the top-level key is `error` (an object), NOT flat `{code, message}`.
    //! `field`, `details`, `retry_after` are omitted via
    //! `skip_serializing_if = "Option::is_none"`.
    use super::*;
    use crate::test_utils::collect_body_str;
    use axum::http::StatusCode;
    use axum::response::IntoResponse;
    use serde_json::{json, Value};

    /// Parse an AppError response body as JSON. Also asserts the
    /// Content-Type header says `application/json` — this is the one
    /// place that check lives.
    async fn parse_json_body(resp: axum::response::Response) -> Value {
        let ct = resp
            .headers()
            .get(axum::http::header::CONTENT_TYPE)
            .cloned()
            .expect("response missing Content-Type");
        let ct_str = ct.to_str().expect("Content-Type not valid ASCII");
        assert!(
            ct_str.contains("application/json"),
            "expected application/json, got {ct_str}"
        );
        let body = collect_body_str(resp).await;
        serde_json::from_str(&body).expect("body is not valid JSON")
    }

    // ──────────────────────────────────────────────────────────────────
    // Status code mapping — one test per variant
    // ──────────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn app_error_validation_returns_400_with_field_and_details() {
        let err = AppError::Validation {
            message: "bad input".to_string(),
            field: Some("email".to_string()),
            details: Some(json!({"reason": "invalid"})),
        };
        let resp = err.into_response();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        let body = parse_json_body(resp).await;
        let msg = body["error"]["message"].as_str().unwrap();
        assert!(msg.contains("bad input"), "message was: {msg}");
        assert_eq!(body["error"]["field"], "email");
    }

    #[tokio::test]
    async fn app_error_not_found_returns_404() {
        let err = AppError::NotFound {
            resource: "lease-123".to_string(),
        };
        let resp = err.into_response();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
        let body = parse_json_body(resp).await;
        let msg = body["error"]["message"].as_str().unwrap();
        assert!(msg.contains("lease-123"), "message was: {msg}");
    }

    #[tokio::test]
    async fn app_error_unauthorized_returns_401() {
        let resp = AppError::Unauthorized.into_response();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
        let body = parse_json_body(resp).await;
        assert_eq!(body["error"]["code"], "UNAUTHORIZED");
    }

    #[tokio::test]
    async fn app_error_forbidden_returns_403() {
        let resp = AppError::Forbidden.into_response();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
        let body = parse_json_body(resp).await;
        assert_eq!(body["error"]["code"], "FORBIDDEN");
    }

    #[tokio::test]
    async fn app_error_rate_limited_returns_429_with_retry_after() {
        let err = AppError::RateLimited {
            retry_after: Some(30),
        };
        let resp = err.into_response();
        assert_eq!(resp.status(), StatusCode::TOO_MANY_REQUESTS);
        let body = parse_json_body(resp).await;
        assert_eq!(body["error"]["code"], "RATE_LIMITED");
        assert_eq!(body["error"]["retry_after"], 30);
    }

    #[tokio::test]
    async fn app_error_external_api_returns_502_with_full_detail() {
        let err = AppError::ExternalApi {
            api: "etl".to_string(),
            message: "upstream timeout".to_string(),
        };
        let resp = err.into_response();
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
        let body = parse_json_body(resp).await;
        let msg = body["error"]["message"].as_str().unwrap();
        // Current format: "{api}: {message}". Both components must leak
        // through — this is the non-sanitized behavior under test.
        assert!(msg.contains("etl"), "message was: {msg}");
        assert!(msg.contains("upstream timeout"), "message was: {msg}");
    }

    #[tokio::test]
    async fn app_error_chain_rpc_returns_502_with_full_detail() {
        let err = AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: "RPC 503".to_string(),
        };
        let resp = err.into_response();
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
        let body = parse_json_body(resp).await;
        let msg = body["error"]["message"].as_str().unwrap();
        assert!(msg.contains("nolus"), "message was: {msg}");
        assert!(msg.contains("RPC 503"), "message was: {msg}");
    }

    #[tokio::test]
    async fn app_error_swap_route_failed_returns_502() {
        let err = AppError::SwapRouteFailed {
            message: "no route from A to B".to_string(),
        };
        let resp = err.into_response();
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
        let body = parse_json_body(resp).await;
        assert_eq!(body["error"]["code"], "SWAP_ROUTE_FAILED");
        let msg = body["error"]["message"].as_str().unwrap();
        assert!(msg.contains("no route from A to B"), "message was: {msg}");
    }

    #[tokio::test]
    async fn app_error_service_unavailable_returns_503() {
        let err = AppError::ServiceUnavailable {
            message: "db offline".to_string(),
        };
        let resp = err.into_response();
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = parse_json_body(resp).await;
        assert_eq!(body["error"]["code"], "SERVICE_UNAVAILABLE");
        let msg = body["error"]["message"].as_str().unwrap();
        assert!(msg.contains("db offline"), "message was: {msg}");
    }

    #[tokio::test]
    async fn app_error_internal_returns_500_with_detail() {
        let err = AppError::Internal("some detail".to_string());
        let resp = err.into_response();
        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
        let body = parse_json_body(resp).await;
        assert_eq!(body["error"]["code"], "INTERNAL_ERROR");
        let msg = body["error"]["message"].as_str().unwrap();
        assert!(msg.contains("some detail"), "message was: {msg}");
    }

    // ──────────────────────────────────────────────────────────────────
    // Conversion tests
    // ──────────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn from_anyhow_error_produces_internal_variant_preserving_context() {
        use anyhow::Context;
        let anyhow_err: anyhow::Error = Err::<(), _>(anyhow::anyhow!("outer error"))
            .context("during fetch")
            .unwrap_err();
        let app_err: AppError = anyhow_err.into();
        match app_err {
            AppError::Internal(msg) => {
                // `anyhow::Error::to_string()` returns the top context
                // (here: "during fetch"). The inner cause is preserved
                // via the `Display` chain when using `{:#}` or
                // `source()`, but `to_string()` only yields the top.
                // Assert the top context is present, which is the
                // contract `From<anyhow::Error>` commits to today.
                assert!(
                    msg.contains("during fetch"),
                    "expected 'during fetch' context in Internal variant, got: {msg}"
                );
            }
            other => panic!("expected AppError::Internal, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn from_reqwest_error_produces_external_api_variant_with_http_api_name() {
        // Provoke a reqwest::Error by firing a request at an unroutable
        // port (TCP 1 on loopback). A 100ms timeout bounds the test.
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(100))
            .build()
            .expect("reqwest client build");
        let reqwest_err = client
            .get("http://127.0.0.1:1/")
            .send()
            .await
            .expect_err("request to 127.0.0.1:1 must fail");
        let app_err: AppError = reqwest_err.into();
        match app_err {
            AppError::ExternalApi { api, message } => {
                assert_eq!(api, "HTTP");
                assert!(
                    !message.is_empty(),
                    "expected non-empty reqwest error message"
                );
            }
            other => panic!("expected AppError::ExternalApi, got {other:?}"),
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Response body structure
    // ──────────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn app_error_response_body_is_json() {
        // parse_json_body does the Content-Type + JSON-parse assertion.
        let resp = AppError::Unauthorized.into_response();
        let _ = parse_json_body(resp).await;
    }

    #[tokio::test]
    async fn app_error_response_body_has_code_and_message_fields() {
        // Actual envelope is `{ "error": { "code", "message", ... } }`.
        // The `error` wrapper is part of the ErrorResponse struct.
        let resp = AppError::Unauthorized.into_response();
        let body = parse_json_body(resp).await;
        let err_obj = body
            .get("error")
            .expect("top-level 'error' key missing from response body");
        assert!(
            err_obj.get("code").is_some(),
            "error.code missing: {err_obj}"
        );
        assert!(
            err_obj.get("message").is_some(),
            "error.message missing: {err_obj}"
        );
    }

    #[tokio::test]
    async fn app_error_validation_response_includes_field_and_details() {
        let err = AppError::Validation {
            message: "bad input".to_string(),
            field: Some("email".to_string()),
            details: Some(json!({"reason": "invalid", "len": 0})),
        };
        let resp = err.into_response();
        let body = parse_json_body(resp).await;
        let err_obj = &body["error"];
        assert_eq!(err_obj["field"], "email");
        assert_eq!(err_obj["details"]["reason"], "invalid");
        assert_eq!(err_obj["details"]["len"], 0);
    }

    // ──────────────────────────────────────────────────────────────────
    // Behavior preservation (documentation tests)
    // ──────────────────────────────────────────────────────────────────

    /// Documents the INTENTIONAL non-sanitization of
    /// `AppError::Internal`. Detailed errors surface the issue to the
    /// user (better UX, faster debugging). Secrets are not present in
    /// error strings because API keys are sent in headers, never URLs.
    ///
    /// If this test starts failing, the change likely sanitized the
    /// body to a generic "Internal server error" string — that was
    /// explicitly vetoed by the user. Revert the source change; do not
    /// "fix" this test.
    #[tokio::test]
    async fn app_error_internal_does_preserve_detailed_message_not_sanitized() {
        let detailed = "connection refused to upstream at http://etl.internal:8080".to_string();
        let resp = AppError::Internal(detailed.clone()).into_response();
        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
        let body = parse_json_body(resp).await;
        let msg = body["error"]["message"].as_str().unwrap();
        assert_eq!(
            msg, detailed,
            "AppError::Internal body MUST preserve the full message verbatim (non-sanitized by design)"
        );
    }

    /// Documents the INTENTIONAL non-sanitization of
    /// `AppError::ExternalApi`. Both the upstream API name and its
    /// error message leak through. Same rationale as
    /// `app_error_internal_does_preserve_detailed_message_not_sanitized`.
    #[tokio::test]
    async fn app_error_external_api_does_preserve_api_and_message() {
        let err = AppError::ExternalApi {
            api: "etl-upstream-v2".to_string(),
            message: "503 Service Unavailable: backend pool drained".to_string(),
        };
        let resp = err.into_response();
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
        let body = parse_json_body(resp).await;
        let msg = body["error"]["message"].as_str().unwrap();
        // Exact format: "{api}: {message}" — both components verbatim.
        assert_eq!(
            msg, "etl-upstream-v2: 503 Service Unavailable: backend pool drained",
            "AppError::ExternalApi body MUST preserve the full api:message string verbatim"
        );
    }
}
