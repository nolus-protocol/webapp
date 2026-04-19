//! Locale/Translation Handler
//!
//! Provides translation files for the frontend and push notifications.

use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;
use tracing::debug;

use crate::error::AppError;
use crate::AppState;

/// Get locale translations
///
/// Returns the i18n translation blob for the requested language code. The
/// response is an opaque JSON object keyed by translation keys — shape is not
/// fixed in this spec.
#[utoipa::path(
    get,
    path = "/api/locales/{lang}",
    tag = "locales",
    params(
        ("lang" = String, Path, description = "Language code (e.g. `en`, `de`, `es`). Max 5 chars, alphanumeric + hyphen."),
    ),
    responses(
        (status = 200, description = "Locale JSON blob (opaque object)", content_type = "application/json", body = Object),
        (status = 400, description = "Invalid language code", body = crate::error::ErrorResponse),
        (status = 404, description = "Language not available", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_locale(
    State(state): State<Arc<AppState>>,
    Path(lang): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    debug!("Fetching locale: {}", lang);

    // Validate language code (basic sanity check)
    if lang.len() > 5 || !lang.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(AppError::Validation {
            message: "Invalid language code".to_string(),
            field: Some("lang".to_string()),
            details: None,
        });
    }

    // Load locale from translation storage
    let locale = state.translation_storage.load_active(&lang).await?;

    Ok(Json(locale))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::{collect_body_str, test_app_state};
    use axum::{body::Body, http::Request, http::StatusCode, routing::get, Router};
    use tower::ServiceExt;

    fn app(state: Arc<AppState>) -> Router {
        Router::new()
            .route("/api/locales/{lang}", get(get_locale))
            .with_state(state)
    }

    #[tokio::test]
    async fn locales_invalid_too_long_returns_400() {
        let app = app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/locales/toolong")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        let body = collect_body_str(resp).await;
        assert!(body.contains("Invalid language code"), "body: {body}");
    }

    #[tokio::test]
    async fn locales_invalid_characters_returns_400() {
        let app = app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/locales/en_US")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn locales_valid_but_missing_returns_error() {
        // With no translations loaded, a valid lang code falls through to
        // translation_storage — which will error when not initialized with
        // data. This exercises the success-path plumbing up to the storage
        // lookup; we just assert it's not a 400.
        let app = app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/locales/en")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_ne!(resp.status(), StatusCode::BAD_REQUEST);
    }
}
