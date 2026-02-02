//! Translation-specific audit log
//!
//! Tracks all translation changes with detailed metadata for compliance
//! and rollback capabilities.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use super::types::TranslationSource;
use crate::error::AppError;

/// Audit action types for translations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuditAction {
    Approve,
    Reject,
    Edit,
    BulkApprove,
    AddLanguage,
    RemoveLanguage,
    Generate,
    Restore,
    DirectEdit,
}

/// A single audit log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationAuditEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub action: AuditAction,
    pub admin_user: Option<String>,
    pub lang: String,

    /// The translation key (for single-key operations)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,

    /// Previous value (for edits/restores)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_value: Option<String>,

    /// New value
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_value: Option<String>,

    /// Source of the translation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<TranslationSource>,

    /// AI model used (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_model: Option<String>,

    /// Rejection reason (if rejected)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,

    /// Count (for bulk operations)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count: Option<usize>,

    /// Batch ID (for generation operations)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,

    /// Additional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// Audit log file structure
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AuditLogFile {
    pub entries: Vec<TranslationAuditEntry>,
}

/// Translation audit log manager
#[derive(Debug)]
pub struct TranslationAuditLog {
    /// Path to the audit log file
    file_path: PathBuf,
    /// In-memory entries (most recent)
    entries: RwLock<Vec<TranslationAuditEntry>>,
    /// Maximum entries to keep in memory
    max_memory_entries: usize,
}

impl TranslationAuditLog {
    /// Create a new audit log
    pub fn new(file_path: PathBuf) -> Self {
        Self {
            file_path,
            entries: RwLock::new(Vec::new()),
            max_memory_entries: 1000,
        }
    }

    /// Initialize the audit log, loading existing entries
    pub async fn init(&self) -> Result<(), AppError> {
        if self.file_path.exists() {
            match self.load_from_file().await {
                Ok(entries) => {
                    let mut log = self.entries.write().await;
                    *log = entries;
                    info!(
                        "Loaded {} translation audit entries",
                        log.len()
                    );
                }
                Err(e) => {
                    warn!("Could not load translation audit log: {}", e);
                }
            }
        }
        Ok(())
    }

    /// Record an audit entry
    pub async fn record(&self, entry: TranslationAuditEntry) {
        {
            let mut log = self.entries.write().await;
            log.push(entry.clone());

            // Trim if exceeds max
            let len = log.len();
            if len > self.max_memory_entries {
                log.drain(0..len - self.max_memory_entries);
            }
        }

        // Persist asynchronously (best effort)
        if let Err(e) = self.persist().await {
            error!("Failed to persist translation audit log: {}", e);
        }

        info!(
            "Translation audit: {:?} - {} - {:?}",
            entry.action,
            entry.lang,
            entry.key
        );
    }

    /// Record a simple approve action
    pub async fn record_approve(
        &self,
        admin_user: Option<String>,
        lang: &str,
        key: &str,
        value: &str,
        source: TranslationSource,
        ai_model: Option<String>,
    ) {
        self.record(TranslationAuditEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            action: AuditAction::Approve,
            admin_user,
            lang: lang.to_string(),
            key: Some(key.to_string()),
            old_value: None,
            new_value: Some(value.to_string()),
            source: Some(source),
            ai_model,
            reason: None,
            count: None,
            batch_id: None,
            metadata: None,
        })
        .await;
    }

    /// Record a reject action
    pub async fn record_reject(
        &self,
        admin_user: Option<String>,
        lang: &str,
        key: &str,
        reason: &str,
    ) {
        self.record(TranslationAuditEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            action: AuditAction::Reject,
            admin_user,
            lang: lang.to_string(),
            key: Some(key.to_string()),
            old_value: None,
            new_value: None,
            source: None,
            ai_model: None,
            reason: Some(reason.to_string()),
            count: None,
            batch_id: None,
            metadata: None,
        })
        .await;
    }

    /// Record an edit action
    pub async fn record_edit(
        &self,
        admin_user: Option<String>,
        lang: &str,
        key: &str,
        old_value: Option<String>,
        new_value: &str,
    ) {
        self.record(TranslationAuditEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            action: AuditAction::Edit,
            admin_user,
            lang: lang.to_string(),
            key: Some(key.to_string()),
            old_value,
            new_value: Some(new_value.to_string()),
            source: Some(TranslationSource::ManualEdit),
            ai_model: None,
            reason: None,
            count: None,
            batch_id: None,
            metadata: None,
        })
        .await;
    }

    /// Record a bulk approve action
    pub async fn record_bulk_approve(
        &self,
        admin_user: Option<String>,
        lang: &str,
        count: usize,
        batch_id: Option<String>,
    ) {
        self.record(TranslationAuditEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            action: AuditAction::BulkApprove,
            admin_user,
            lang: lang.to_string(),
            key: None,
            old_value: None,
            new_value: None,
            source: None,
            ai_model: None,
            reason: None,
            count: Some(count),
            batch_id,
            metadata: None,
        })
        .await;
    }

    /// Record an add language action
    pub async fn record_add_language(
        &self,
        admin_user: Option<String>,
        lang: &str,
        label: &str,
        copied_from: Option<String>,
    ) {
        self.record(TranslationAuditEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            action: AuditAction::AddLanguage,
            admin_user,
            lang: lang.to_string(),
            key: None,
            old_value: None,
            new_value: None,
            source: None,
            ai_model: None,
            reason: None,
            count: None,
            batch_id: None,
            metadata: Some(serde_json::json!({
                "label": label,
                "copied_from": copied_from
            })),
        })
        .await;
    }

    /// Record a generate action
    pub async fn record_generate(
        &self,
        admin_user: Option<String>,
        lang: &str,
        count: usize,
        batch_id: &str,
        ai_model: &str,
    ) {
        self.record(TranslationAuditEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            action: AuditAction::Generate,
            admin_user,
            lang: lang.to_string(),
            key: None,
            old_value: None,
            new_value: None,
            source: Some(TranslationSource::AiGenerated),
            ai_model: Some(ai_model.to_string()),
            reason: None,
            count: Some(count),
            batch_id: Some(batch_id.to_string()),
            metadata: None,
        })
        .await;
    }

    /// Query audit entries
    pub async fn query(
        &self,
        lang: Option<&str>,
        action: Option<AuditAction>,
        key: Option<&str>,
        from: Option<DateTime<Utc>>,
        limit: usize,
        offset: usize,
    ) -> Vec<TranslationAuditEntry> {
        let log = self.entries.read().await;

        let filtered: Vec<_> = log
            .iter()
            .filter(|entry| {
                if let Some(l) = lang {
                    if entry.lang != l {
                        return false;
                    }
                }
                if let Some(ref a) = action {
                    if entry.action != *a {
                        return false;
                    }
                }
                if let Some(k) = key {
                    if entry.key.as_deref() != Some(k) {
                        return false;
                    }
                }
                if let Some(f) = from {
                    if entry.timestamp < f {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect();

        // Return most recent first
        filtered
            .into_iter()
            .rev()
            .skip(offset)
            .take(limit.min(100))
            .collect()
    }

    /// Get history for a specific key
    pub async fn get_key_history(&self, lang: &str, key: &str) -> Vec<TranslationAuditEntry> {
        self.query(Some(lang), None, Some(key), None, 100, 0).await
    }

    /// Load entries from file
    async fn load_from_file(&self) -> Result<Vec<TranslationAuditEntry>, AppError> {
        let content = fs::read_to_string(&self.file_path)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read audit log: {}", e)))?;

        let file: AuditLogFile = serde_json::from_str(&content)
            .map_err(|e| AppError::Internal(format!("Failed to parse audit log: {}", e)))?;

        Ok(file.entries)
    }

    /// Persist entries to file
    async fn persist(&self) -> Result<(), AppError> {
        let entries = self.entries.read().await;

        let file = AuditLogFile {
            entries: entries.clone(),
        };

        let content = serde_json::to_string_pretty(&file)
            .map_err(|e| AppError::Internal(format!("Failed to serialize audit log: {}", e)))?;

        // Ensure parent directory exists
        if let Some(parent) = self.file_path.parent() {
            fs::create_dir_all(parent).await.ok();
        }

        // Write to temp file first, then rename (atomic)
        let temp_path = self.file_path.with_extension("json.tmp");
        fs::write(&temp_path, &content)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to write audit log: {}", e)))?;

        fs::rename(&temp_path, &self.file_path)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to save audit log: {}", e)))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_audit_log_record_and_query() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("audit.json");
        let audit_log = TranslationAuditLog::new(file_path);

        audit_log
            .record_approve(
                Some("admin@test.com".to_string()),
                "ru",
                "message.hello",
                "Привет",
                TranslationSource::AiGenerated,
                Some("gpt-4o-mini".to_string()),
            )
            .await;

        let entries = audit_log.query(Some("ru"), None, None, None, 10, 0).await;
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].action, AuditAction::Approve);
        assert_eq!(entries[0].lang, "ru");
    }

    #[tokio::test]
    async fn test_audit_log_key_history() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("audit.json");
        let audit_log = TranslationAuditLog::new(file_path);

        // Record multiple actions for the same key
        audit_log
            .record_approve(
                None,
                "ru",
                "message.hello",
                "Привет",
                TranslationSource::AiGenerated,
                None,
            )
            .await;

        audit_log
            .record_edit(None, "ru", "message.hello", Some("Привет".to_string()), "Здравствуйте")
            .await;

        let history = audit_log.get_key_history("ru", "message.hello").await;
        assert_eq!(history.len(), 2);
        // Most recent first
        assert_eq!(history[0].action, AuditAction::Edit);
        assert_eq!(history[1].action, AuditAction::Approve);
    }
}
