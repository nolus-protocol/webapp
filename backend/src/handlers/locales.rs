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

/// GET /api/locales/:lang
/// Returns locale translations for the specified language
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
