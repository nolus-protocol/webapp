use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

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

    #[error("Internal error: {0}")]
    Internal(String),
}

/// Error response body
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: ErrorBody,
}

#[derive(Debug, Serialize)]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
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
