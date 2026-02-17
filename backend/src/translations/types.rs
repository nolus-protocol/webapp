//! Types for translation management

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Language configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Language {
    pub key: String,
    pub label: String,
    #[serde(default)]
    pub is_source: bool,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

fn default_true() -> bool {
    true
}

/// Languages configuration file
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LanguagesConfig {
    pub languages: Vec<Language>,
}

impl LanguagesConfig {
    pub fn get_source_language(&self) -> Option<&Language> {
        self.languages.iter().find(|l| l.is_source)
    }

    pub fn get_active_languages(&self) -> Vec<&Language> {
        self.languages.iter().filter(|l| l.is_active).collect()
    }

    pub fn get_target_languages(&self) -> Vec<&Language> {
        self.languages
            .iter()
            .filter(|l| l.is_active && !l.is_source)
            .collect()
    }
}

/// Status of a pending translation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PendingStatus {
    Pending,
    Approved,
    Rejected,
    Edited,
}

/// Source of a translation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TranslationSource {
    AiGenerated,
    ManualEdit,
    Imported,
}

/// A pending translation awaiting approval
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingTranslation {
    pub id: String,
    pub created_at: DateTime<Utc>,

    // Source
    pub source_key: String,
    pub source_value: String,

    // Target
    pub target_lang: String,
    pub proposed_value: String,

    // Validation
    pub placeholders: Vec<String>,
    pub placeholders_valid: bool,

    // Status
    pub status: PendingStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reviewed_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reviewed_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edited_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rejection_reason: Option<String>,

    // Metadata
    pub source: TranslationSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,
}

/// Pending translations storage file
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PendingTranslationsFile {
    pub translations: Vec<PendingTranslation>,
}

/// Missing keys detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissingKeysResult {
    pub lang: String,
    pub missing_keys: Vec<MissingKey>,
    pub total_source_keys: usize,
    pub total_target_keys: usize,
}

/// A missing translation key
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissingKey {
    pub key: String,
    pub source_value: String,
    pub placeholders: Vec<String>,
}

/// Generation status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GenerationStatus {
    Queued,
    Processing,
    Completed,
    Failed,
}

/// Generation batch tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationBatch {
    pub id: String,
    pub lang: String,
    pub created_at: DateTime<Utc>,
    pub status: GenerationStatus,
    pub total_keys: usize,
    pub completed_keys: usize,
    pub failed_keys: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Language info response (includes stats)
#[derive(Debug, Clone, Serialize)]
pub struct LanguageInfo {
    pub key: String,
    pub label: String,
    pub is_source: bool,
    pub is_active: bool,
    pub key_count: usize,
    pub missing_count: usize,
    pub pending_count: usize,
    pub is_complete: bool,
}

/// Glossary configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GlossaryConfig {
    pub terms: HashMap<String, String>,
}
