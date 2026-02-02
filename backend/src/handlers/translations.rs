//! Admin API handlers for translation management
//!
//! Provides endpoints for:
//! - Detecting missing translations
//! - Generating AI translations
//! - Reviewing and approving pending translations
//! - Direct editing of active translations
//! - Language management
//! - Audit log access

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tracing::info;
use uuid::Uuid;

use crate::error::AppError;
use crate::translations::{
    extract_placeholders, MissingKey, PendingStatus,
    PendingTranslation, TranslationSource, TranslationStorage,
};
use crate::translations::audit::AuditAction;
use crate::translations::openai::{OpenAIClient, TranslationInput};
use crate::AppState;

// =========================================================================
// Query Parameters
// =========================================================================

#[derive(Debug, Deserialize)]
pub struct ListPendingQuery {
    pub lang: Option<String>,
    pub status: Option<String>,
    pub batch_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub lang: Option<String>,
    pub action: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct GenerateQuery {
    pub lang: String,
    #[serde(default)]
    pub keys: Vec<String>,
}

// =========================================================================
// Request/Response Types
// =========================================================================

#[derive(Debug, Deserialize)]
pub struct ApproveRequest {
    #[serde(default)]
    pub ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct RejectRequest {
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct EditRequest {
    pub value: String,
}

#[derive(Debug, Deserialize)]
pub struct AddLanguageRequest {
    pub key: String,
    pub label: String,
    #[serde(default)]
    pub copy_from: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SyncResponse {
    pub synced_at: chrono::DateTime<Utc>,
    pub source_key_count: usize,
    pub languages: Vec<LanguageSyncStatus>,
}

#[derive(Debug, Serialize)]
pub struct LanguageSyncStatus {
    pub lang: String,
    pub total_keys: usize,
    pub missing_keys: usize,
    pub pending_keys: usize,
}

#[derive(Debug, Serialize)]
pub struct GenerateResponse {
    pub batch_id: String,
    pub lang: String,
    pub total_keys: usize,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct ApproveResponse {
    pub approved_count: usize,
}

// =========================================================================
// Sync & Detection Handlers
// =========================================================================

/// POST /admin/translations/sync
/// Detect missing keys across all languages
pub async fn sync_translations(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;

    let languages = storage.load_languages().await?;
    let source_lang = languages
        .get_source_language()
        .ok_or_else(|| AppError::Internal("No source language configured".to_string()))?;

    let source_locale = storage.load_active(&source_lang.key).await?;
    let source_key_count = count_json_keys(&source_locale);

    let mut lang_statuses = Vec::new();

    for lang in languages.get_target_languages() {
        let info = storage.get_language_info(&lang.key).await?;
        lang_statuses.push(LanguageSyncStatus {
            lang: lang.key.clone(),
            total_keys: info.key_count,
            missing_keys: info.missing_count,
            pending_keys: info.pending_count,
        });
    }

    info!(
        "Translation sync: {} source keys, {} languages",
        source_key_count,
        lang_statuses.len()
    );

    Ok(Json(SyncResponse {
        synced_at: Utc::now(),
        source_key_count,
        languages: lang_statuses,
    }))
}

/// GET /admin/translations/missing
/// List all missing translation keys
pub async fn list_missing(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListPendingQuery>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;

    if let Some(lang) = query.lang {
        let result = storage.detect_missing(&lang).await?;
        Ok(Json(vec![result]))
    } else {
        let results = storage.detect_all_missing().await?;
        Ok(Json(results))
    }
}

// =========================================================================
// Generation Handlers
// =========================================================================

/// POST /admin/translations/generate
/// Generate AI translations for missing keys
pub async fn generate_translations(
    State(state): State<Arc<AppState>>,
    Json(request): Json<GenerateQuery>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;
    let openai = get_openai_client(&state)?;

    if !openai.is_configured() {
        return Err(AppError::Internal(
            "OpenAI API key not configured. Set OPENAI_API_KEY environment variable.".to_string(),
        ));
    }

    // Get missing keys
    let missing_result = storage.detect_missing(&request.lang).await?;

    // Filter to requested keys if specified
    let keys_to_translate: Vec<&MissingKey> = if request.keys.is_empty() {
        missing_result.missing_keys.iter().collect()
    } else {
        missing_result
            .missing_keys
            .iter()
            .filter(|k| request.keys.contains(&k.key))
            .collect()
    };

    if keys_to_translate.is_empty() {
        return Ok(Json(GenerateResponse {
            batch_id: String::new(),
            lang: request.lang,
            total_keys: 0,
            status: "no_keys_to_translate".to_string(),
        }));
    }

    let batch_id = Uuid::new_v4().to_string();
    let lang = request.lang.clone();
    let total_keys = keys_to_translate.len();

    // Build translation inputs
    let inputs: Vec<TranslationInput> = keys_to_translate
        .iter()
        .map(|k| TranslationInput {
            key: k.key.clone(),
            value: k.source_value.clone(),
            placeholders: k.placeholders.clone(),
        })
        .collect();

    // Load context and glossary (if available)
    let context = load_translation_context(&state).await;
    let glossary = load_glossary(&state).await;

    // Generate translations
    let result = openai
        .translate_batch("en", &lang, &inputs, context.as_deref(), glossary.as_ref())
        .await?;

    // Create pending translations
    let mut pending_translations = Vec::new();
    for output in result.translations {
        pending_translations.push(PendingTranslation {
            id: Uuid::new_v4().to_string(),
            created_at: Utc::now(),
            source_key: output.key.clone(),
            source_value: output.source_value.clone(),
            target_lang: lang.clone(),
            proposed_value: output.translated_value.clone(),
            placeholders: extract_placeholders(&output.source_value),
            placeholders_valid: output.placeholders_valid,
            status: PendingStatus::Pending,
            reviewed_by: None,
            reviewed_at: None,
            edited_value: None,
            rejection_reason: None,
            source: TranslationSource::AiGenerated,
            ai_model: Some(openai.model().to_string()),
            batch_id: Some(batch_id.clone()),
        });
    }

    // Save pending translations
    storage.add_pending_batch(pending_translations).await?;

    // Record in audit log
    storage
        .audit_log()
        .record_generate(None, &lang, total_keys, &batch_id, openai.model())
        .await;

    info!(
        "Generated {} translations for {} (batch: {})",
        total_keys, lang, batch_id
    );

    Ok(Json(GenerateResponse {
        batch_id,
        lang,
        total_keys,
        status: "completed".to_string(),
    }))
}

// =========================================================================
// Pending Translation Handlers
// =========================================================================

/// GET /admin/translations/pending
/// List pending translations awaiting approval
pub async fn list_pending(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListPendingQuery>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;

    let status = query.status.as_deref().and_then(|s| match s {
        "pending" => Some(PendingStatus::Pending),
        "approved" => Some(PendingStatus::Approved),
        "rejected" => Some(PendingStatus::Rejected),
        "edited" => Some(PendingStatus::Edited),
        _ => None,
    });

    let pending = storage
        .list_pending(query.lang.as_deref(), status)
        .await?;

    // Filter by batch_id if specified
    let filtered: Vec<_> = if let Some(batch_id) = &query.batch_id {
        pending
            .into_iter()
            .filter(|p| p.batch_id.as_ref() == Some(batch_id))
            .collect()
    } else {
        pending
    };

    Ok(Json(filtered))
}

/// GET /admin/translations/pending/:id
/// Get single pending translation details
pub async fn get_pending(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;
    let pending = storage.get_pending(&id).await?;
    Ok(Json(pending))
}

/// POST /admin/translations/pending/:id/approve
/// Approve a pending translation
pub async fn approve_pending(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;

    // TODO: Get admin user from auth context
    let admin_user = None;

    storage.approve_pending(&id, admin_user).await?;

    Ok(Json(serde_json::json!({ "status": "approved", "id": id })))
}

/// POST /admin/translations/pending/:id/reject
/// Reject a pending translation
pub async fn reject_pending(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(request): Json<RejectRequest>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;

    // TODO: Get admin user from auth context
    let admin_user = None;

    storage
        .reject_pending(&id, &request.reason, admin_user)
        .await?;

    Ok(Json(serde_json::json!({ "status": "rejected", "id": id })))
}

/// POST /admin/translations/pending/:id/edit
/// Edit and approve a pending translation
pub async fn edit_pending(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(request): Json<EditRequest>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;

    // TODO: Get admin user from auth context
    let admin_user = None;

    storage
        .edit_pending(&id, &request.value, admin_user)
        .await?;

    Ok(Json(serde_json::json!({ "status": "edited_and_approved", "id": id })))
}

/// POST /admin/translations/pending/approve-batch
/// Bulk approve multiple pending translations
pub async fn approve_batch(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ApproveRequest>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;

    // TODO: Get admin user from auth context
    let admin_user = None;

    let approved_count = storage
        .approve_pending_batch(&request.ids, admin_user)
        .await?;

    Ok(Json(ApproveResponse { approved_count }))
}

// =========================================================================
// Active Translation Handlers
// =========================================================================

/// GET /admin/translations/active
/// Get all active translations for a language
pub async fn get_active(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListPendingQuery>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;

    let lang = query.lang.ok_or_else(|| AppError::Validation {
        message: "lang query parameter is required".to_string(),
        field: Some("lang".to_string()),
        details: None,
    })?;

    let locale = storage.load_active(&lang).await?;
    Ok(Json(locale))
}

/// PUT /admin/translations/active/:lang/:key
/// Directly edit an active translation
pub async fn update_active(
    State(state): State<Arc<AppState>>,
    Path((lang, key)): Path<(String, String)>,
    Json(request): Json<EditRequest>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;

    // TODO: Get admin user from auth context
    let admin_user = None;

    // Decode the key (it may be URL encoded with dots as %2E)
    let decoded_key = urlencoding::decode(&key)
        .map_err(|_| AppError::Validation {
            message: "Invalid key encoding".to_string(),
            field: Some("key".to_string()),
            details: None,
        })?
        .into_owned();

    storage
        .set_active_key(&lang, &decoded_key, &request.value, admin_user)
        .await?;

    Ok(Json(serde_json::json!({
        "status": "updated",
        "lang": lang,
        "key": decoded_key
    })))
}

// =========================================================================
// Language Management Handlers
// =========================================================================

/// GET /admin/translations/languages
/// List all configured languages with stats
pub async fn list_languages(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;
    let languages = storage.list_languages_with_info().await?;
    Ok(Json(languages))
}

/// POST /admin/translations/languages
/// Add a new language
pub async fn add_language(
    State(state): State<Arc<AppState>>,
    Json(request): Json<AddLanguageRequest>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;

    // TODO: Get admin user from auth context
    let admin_user = None;

    storage
        .add_language(
            &request.key,
            &request.label,
            request.copy_from.as_deref(),
            admin_user,
        )
        .await?;

    // TODO: If auto_generate is true, trigger translation generation

    Ok(Json(serde_json::json!({
        "status": "created",
        "key": request.key,
        "label": request.label
    })))
}

// =========================================================================
// Audit Log Handlers
// =========================================================================

/// GET /admin/translations/audit
/// Get audit log entries
pub async fn get_audit_log(
    State(state): State<Arc<AppState>>,
    Query(query): Query<AuditQuery>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;

    let limit = query.limit.unwrap_or(100);
    
    // Parse action filter if provided
    let action = query.action.as_deref().and_then(|a| match a {
        "approve" => Some(AuditAction::Approve),
        "reject" => Some(AuditAction::Reject),
        "edit" => Some(AuditAction::Edit),
        "bulk_approve" => Some(AuditAction::BulkApprove),
        "add_language" => Some(AuditAction::AddLanguage),
        "generate" => Some(AuditAction::Generate),
        _ => None,
    });

    let entries = storage
        .audit_log()
        .query(query.lang.as_deref(), action, None, None, limit, 0)
        .await;

    Ok(Json(entries))
}

/// GET /admin/translations/key-history/:lang/:key
/// Get full history of a specific translation key
pub async fn get_key_history(
    State(state): State<Arc<AppState>>,
    Path((lang, key)): Path<(String, String)>,
) -> Result<impl IntoResponse, AppError> {
    let storage = get_translation_storage(&state)?;

    let decoded_key = urlencoding::decode(&key)
        .map_err(|_| AppError::Validation {
            message: "Invalid key encoding".to_string(),
            field: Some("key".to_string()),
            details: None,
        })?
        .into_owned();

    let history = storage
        .audit_log()
        .get_key_history(&lang, &decoded_key)
        .await;

    Ok(Json(history))
}

// =========================================================================
// Helper Functions
// =========================================================================

/// Get translation storage from app state
fn get_translation_storage(state: &AppState) -> Result<&TranslationStorage, AppError> {
    Ok(&state.translation_storage)
}

/// Get OpenAI client from app state
fn get_openai_client(state: &AppState) -> Result<&OpenAIClient, AppError> {
    Ok(&state.openai_client)
}

/// Load translation context from config file
async fn load_translation_context(_state: &AppState) -> Option<String> {
    // Default context for Nolus translations
    Some(r#"Nolus is a DeFi money market protocol built on Cosmos SDK.

Key concepts:
- Lease: A leveraged position where users borrow to amplify exposure
- LTV (Loan-to-Value): Ratio of borrowed amount to total position value
- Liquidation: Automatic position closure when LTV exceeds threshold
- LPP (Liquidity Provider Pool): Pool that provides lending capital
- NLS: Native Nolus token used for governance and staking

Financial terms should maintain technical accuracy.
Keep translations concise and clear for UI elements."#.to_string())
}

/// Load glossary from config file
async fn load_glossary(_state: &AppState) -> Option<crate::translations::GlossaryConfig> {
    // Default glossary - terms that should not be translated
    let mut glossary = crate::translations::GlossaryConfig::default();
    glossary.terms.insert("Nolus".to_string(), String::new());
    glossary.terms.insert("NLS".to_string(), String::new());
    glossary.terms.insert("USDC".to_string(), String::new());
    glossary.terms.insert("ATOM".to_string(), String::new());
    glossary.terms.insert("Cosmos".to_string(), String::new());
    glossary.terms.insert("IBC".to_string(), String::new());
    glossary.terms.insert("DeFi".to_string(), String::new());
    glossary.terms.insert("APR".to_string(), String::new());
    glossary.terms.insert("TVL".to_string(), String::new());
    glossary.terms.insert("LTV".to_string(), String::new());
    Some(glossary)
}

/// Count keys in a JSON value (helper)
fn count_json_keys(value: &serde_json::Value) -> usize {
    match value {
        serde_json::Value::Object(map) => {
            let mut count = 0;
            for v in map.values() {
                if v.is_object() {
                    count += count_json_keys(v);
                } else {
                    count += 1;
                }
            }
            count
        }
        _ => 1,
    }
}
