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
