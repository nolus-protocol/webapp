//! Translation storage management
//!
//! Handles locale file storage, pending translations queue,
//! and language configuration.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use serde_json::Value;
use tokio::fs;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use super::audit::TranslationAuditLog;
use super::types::*;
use super::validation::{extract_placeholders, validate_placeholders};
use crate::error::AppError;

/// Translation storage manager
#[derive(Debug)]
pub struct TranslationStorage {
    /// Base directory for locales
    locales_dir: PathBuf,
    /// Cached active locales
    cached_locales: Arc<RwLock<HashMap<String, Value>>>,
    /// Cached languages config
    cached_languages: Arc<RwLock<Option<LanguagesConfig>>>,
    /// Cached pending translations
    cached_pending: Arc<RwLock<Option<PendingTranslationsFile>>>,
    /// Audit log
    audit_log: Arc<TranslationAuditLog>,
}

impl TranslationStorage {
    /// Create a new translation storage
    pub fn new(config_dir: &Path) -> Self {
        let locales_dir = config_dir.join("locales");
        let audit_path = locales_dir.join("audit.json");

        Self {
            locales_dir,
            cached_locales: Arc::new(RwLock::new(HashMap::new())),
            cached_languages: Arc::new(RwLock::new(None)),
            cached_pending: Arc::new(RwLock::new(None)),
            audit_log: Arc::new(TranslationAuditLog::new(audit_path)),
        }
    }

    /// Initialize storage, creating directories if needed
    pub async fn init(&self) -> Result<(), AppError> {
        // Create directories
        let dirs = [
            self.locales_dir.clone(),
            self.locales_dir.join("active"),
        ];

        for dir in &dirs {
            if !dir.exists() {
                fs::create_dir_all(dir).await.map_err(|e| {
                    AppError::Internal(format!("Failed to create directory {:?}: {}", dir, e))
                })?;
                info!("Created directory: {:?}", dir);
            }
        }

        // Initialize audit log
        self.audit_log.init().await?;

        // Initialize languages config if not exists
        if !self.languages_path().exists() {
            let default_languages = LanguagesConfig {
                languages: vec![
                    Language { key: "en".to_string(), label: "English".to_string(), is_source: true, is_active: true },
                    Language { key: "ru".to_string(), label: "Русский".to_string(), is_source: false, is_active: true },
                    Language { key: "cn".to_string(), label: "中文".to_string(), is_source: false, is_active: true },
                    Language { key: "fr".to_string(), label: "Français".to_string(), is_source: false, is_active: true },
                    Language { key: "es".to_string(), label: "Español".to_string(), is_source: false, is_active: true },
                    Language { key: "gr".to_string(), label: "Ελληνικά".to_string(), is_source: false, is_active: true },
                    Language { key: "tr".to_string(), label: "Türkçe".to_string(), is_source: false, is_active: true },
                    Language { key: "id".to_string(), label: "Bahasa Indo".to_string(), is_source: false, is_active: true },
                    Language { key: "jp".to_string(), label: "日本語".to_string(), is_source: false, is_active: true },
                    Language { key: "kr".to_string(), label: "한국어".to_string(), is_source: false, is_active: true },
                ],
            };
            self.save_languages(&default_languages).await?;
            info!("Created default languages configuration");
        }

        Ok(())
    }

    /// Get the audit log reference
    pub fn audit_log(&self) -> &TranslationAuditLog {
        &self.audit_log
    }

    // =========================================================================
    // Path helpers
    // =========================================================================

    fn active_path(&self, lang: &str) -> PathBuf {
        self.locales_dir.join("active").join(format!("{}.json", lang))
    }

    fn pending_path(&self) -> PathBuf {
        self.locales_dir.join("pending.json")
    }

    fn languages_path(&self) -> PathBuf {
        self.locales_dir.join("languages.json")
    }

    // =========================================================================
    // Languages
    // =========================================================================

    /// Load languages configuration
    pub async fn load_languages(&self) -> Result<LanguagesConfig, AppError> {
        // Check cache
        {
            let cache = self.cached_languages.read().await;
            if let Some(ref config) = *cache {
                return Ok(config.clone());
            }
        }

        // Load from file
        let path = self.languages_path();
        if !path.exists() {
            return Err(AppError::NotFound {
                resource: "Languages configuration".to_string(),
            });
        }

        let content = fs::read_to_string(&path)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read languages config: {}", e)))?;

        let config: LanguagesConfig = serde_json::from_str(&content)
            .map_err(|e| AppError::Internal(format!("Failed to parse languages config: {}", e)))?;

        // Update cache
        {
            let mut cache = self.cached_languages.write().await;
            *cache = Some(config.clone());
        }

        Ok(config)
    }

    /// Save languages configuration
    pub async fn save_languages(&self, config: &LanguagesConfig) -> Result<(), AppError> {
        let path = self.languages_path();
        let content = serde_json::to_string_pretty(config)
            .map_err(|e| AppError::Internal(format!("Failed to serialize languages: {}", e)))?;

        fs::write(&path, content)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to write languages config: {}", e)))?;

        // Invalidate cache
        {
            let mut cache = self.cached_languages.write().await;
            *cache = Some(config.clone());
        }

        Ok(())
    }

    /// Add a new language
    pub async fn add_language(
        &self,
        key: &str,
        label: &str,
        copy_from: Option<&str>,
        admin_user: Option<String>,
    ) -> Result<(), AppError> {
        let mut config = self.load_languages().await?;

        // Check if language already exists
        if config.languages.iter().any(|l| l.key == key) {
            return Err(AppError::Validation {
                message: format!("Language '{}' already exists", key),
                field: Some("key".to_string()),
                details: None,
            });
        }

        // Add new language
        config.languages.push(Language {
            key: key.to_string(),
            label: label.to_string(),
            is_source: false,
            is_active: true,
        });

        self.save_languages(&config).await?;

        // Create locale file
        let initial_content = if let Some(source_lang) = copy_from {
            self.load_active(source_lang).await.unwrap_or_else(|_| serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        self.save_active(key, &initial_content).await?;

        // Record audit
        self.audit_log
            .record_add_language(admin_user, key, label, copy_from.map(String::from))
            .await;

        info!("Added new language: {} ({})", key, label);
        Ok(())
    }

    /// Get language info with statistics
    pub async fn get_language_info(&self, lang: &str) -> Result<LanguageInfo, AppError> {
        let languages = self.load_languages().await?;
        let language = languages
            .languages
            .iter()
            .find(|l| l.key == lang)
            .ok_or_else(|| AppError::NotFound {
                resource: format!("Language: {}", lang),
            })?;

        let source_lang = languages.get_source_language().map(|l| &l.key);
        let source_key_count = if let Some(src) = source_lang {
            self.count_keys(src).await.unwrap_or(0)
        } else {
            0
        };

        let key_count = self.count_keys(lang).await.unwrap_or(0);
        let pending_count = self.count_pending_for_lang(lang).await;
        let missing_count = if language.is_source {
            0
        } else {
            source_key_count.saturating_sub(key_count)
        };

        Ok(LanguageInfo {
            key: language.key.clone(),
            label: language.label.clone(),
            is_source: language.is_source,
            is_active: language.is_active,
            key_count,
            missing_count,
            pending_count,
            is_complete: missing_count == 0 && pending_count == 0,
        })
    }

    /// List all languages with info
    pub async fn list_languages_with_info(&self) -> Result<Vec<LanguageInfo>, AppError> {
        let languages = self.load_languages().await?;
        let mut result = Vec::new();

        for lang in &languages.languages {
            match self.get_language_info(&lang.key).await {
                Ok(info) => result.push(info),
                Err(e) => warn!("Failed to get info for language {}: {}", lang.key, e),
            }
        }

        Ok(result)
    }

    // =========================================================================
    // Active locales
    // =========================================================================

    /// Load active locale for a language
    pub async fn load_active(&self, lang: &str) -> Result<Value, AppError> {
        // Check cache
        {
            let cache = self.cached_locales.read().await;
            if let Some(locale) = cache.get(lang) {
                return Ok(locale.clone());
            }
        }

        // Load from file
        let path = self.active_path(lang);
        if !path.exists() {
            return Err(AppError::NotFound {
                resource: format!("Locale: {}", lang),
            });
        }

        let content = fs::read_to_string(&path)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read locale {}: {}", lang, e)))?;

        let locale: Value = serde_json::from_str(&content)
            .map_err(|e| AppError::Internal(format!("Failed to parse locale {}: {}", lang, e)))?;

        // Update cache
        {
            let mut cache = self.cached_locales.write().await;
            cache.insert(lang.to_string(), locale.clone());
        }

        Ok(locale)
    }

    /// Save active locale
    pub async fn save_active(&self, lang: &str, content: &Value) -> Result<(), AppError> {
        let path = self.active_path(lang);

        // Ensure directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await.ok();
        }

        let json = serde_json::to_string_pretty(content)
            .map_err(|e| AppError::Internal(format!("Failed to serialize locale: {}", e)))?;

        // Atomic write
        let temp_path = path.with_extension("json.tmp");
        fs::write(&temp_path, &json)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to write locale: {}", e)))?;

        fs::rename(&temp_path, &path)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to save locale: {}", e)))?;

        // Update cache
        {
            let mut cache = self.cached_locales.write().await;
            cache.insert(lang.to_string(), content.clone());
        }

        debug!("Saved active locale: {}", lang);
        Ok(())
    }

    /// Set a single key in an active locale
    pub async fn set_active_key(
        &self,
        lang: &str,
        key: &str,
        value: &str,
        admin_user: Option<String>,
    ) -> Result<(), AppError> {
        let mut locale = self.load_active(lang).await.unwrap_or_else(|_| serde_json::json!({}));

        // Get old value for audit
        let old_value = get_nested_value(&locale, key).map(|v| v.to_string());

        // Set the nested value
        set_nested_value(&mut locale, key, Value::String(value.to_string()));

        self.save_active(lang, &locale).await?;

        // Record audit
        self.audit_log
            .record_edit(admin_user, lang, key, old_value, value)
            .await;

        Ok(())
    }

    /// Count keys in a locale
    async fn count_keys(&self, lang: &str) -> Result<usize, AppError> {
        let locale = self.load_active(lang).await?;
        Ok(count_json_keys(&locale))
    }

    // =========================================================================
    // Missing keys detection
    // =========================================================================

    /// Detect missing keys for a language
    pub async fn detect_missing(&self, lang: &str) -> Result<MissingKeysResult, AppError> {
        let languages = self.load_languages().await?;
        let source_lang = languages
            .get_source_language()
            .ok_or_else(|| AppError::Internal("No source language configured".to_string()))?;

        let source_locale = self.load_active(&source_lang.key).await?;
        let target_locale = self.load_active(lang).await.unwrap_or_else(|_| serde_json::json!({}));

        let source_keys = flatten_json(&source_locale, "");
        let target_keys = flatten_json(&target_locale, "");

        let mut missing_keys = Vec::new();
        for (key, value) in &source_keys {
            if !target_keys.contains_key(key) {
                if let Some(source_value) = value.as_str() {
                    missing_keys.push(MissingKey {
                        key: key.clone(),
                        source_value: source_value.to_string(),
                        placeholders: extract_placeholders(source_value),
                    });
                }
            }
        }

        Ok(MissingKeysResult {
            lang: lang.to_string(),
            missing_keys,
            total_source_keys: source_keys.len(),
            total_target_keys: target_keys.len(),
        })
    }

    /// Detect missing keys for all languages
    pub async fn detect_all_missing(&self) -> Result<Vec<MissingKeysResult>, AppError> {
        let languages = self.load_languages().await?;
        let mut results = Vec::new();

        for lang in languages.get_target_languages() {
            match self.detect_missing(&lang.key).await {
                Ok(result) => results.push(result),
                Err(e) => warn!("Failed to detect missing for {}: {}", lang.key, e),
            }
        }

        Ok(results)
    }

    // =========================================================================
    // Pending translations
    // =========================================================================

    /// Load pending translations
    pub async fn load_pending(&self) -> Result<PendingTranslationsFile, AppError> {
        // Check cache
        {
            let cache = self.cached_pending.read().await;
            if let Some(ref pending) = *cache {
                return Ok(pending.clone());
            }
        }

        let path = self.pending_path();
        if !path.exists() {
            return Ok(PendingTranslationsFile::default());
        }

        let content = fs::read_to_string(&path)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read pending translations: {}", e)))?;

        let pending: PendingTranslationsFile = serde_json::from_str(&content)
            .map_err(|e| AppError::Internal(format!("Failed to parse pending translations: {}", e)))?;

        // Update cache
        {
            let mut cache = self.cached_pending.write().await;
            *cache = Some(pending.clone());
        }

        Ok(pending)
    }

    /// Save pending translations
    pub async fn save_pending(&self, pending: &PendingTranslationsFile) -> Result<(), AppError> {
        let path = self.pending_path();
        let content = serde_json::to_string_pretty(pending)
            .map_err(|e| AppError::Internal(format!("Failed to serialize pending: {}", e)))?;

        let temp_path = path.with_extension("json.tmp");
        fs::write(&temp_path, &content)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to write pending: {}", e)))?;

        fs::rename(&temp_path, &path)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to save pending: {}", e)))?;

        // Update cache
        {
            let mut cache = self.cached_pending.write().await;
            *cache = Some(pending.clone());
        }

        Ok(())
    }

    /// Add a pending translation
    pub async fn add_pending(&self, translation: PendingTranslation) -> Result<(), AppError> {
        let mut pending = self.load_pending().await?;
        pending.translations.push(translation);
        self.save_pending(&pending).await
    }

    /// Add multiple pending translations
    pub async fn add_pending_batch(&self, translations: Vec<PendingTranslation>) -> Result<(), AppError> {
        let mut pending = self.load_pending().await?;
        pending.translations.extend(translations);
        self.save_pending(&pending).await
    }

    /// Get pending translation by ID
    pub async fn get_pending(&self, id: &str) -> Result<PendingTranslation, AppError> {
        let pending = self.load_pending().await?;
        pending
            .translations
            .into_iter()
            .find(|t| t.id == id)
            .ok_or_else(|| AppError::NotFound {
                resource: format!("Pending translation: {}", id),
            })
    }

    /// List pending translations with optional filter
    pub async fn list_pending(
        &self,
        lang: Option<&str>,
        status: Option<PendingStatus>,
    ) -> Result<Vec<PendingTranslation>, AppError> {
        let pending = self.load_pending().await?;

        Ok(pending
            .translations
            .into_iter()
            .filter(|t| {
                if let Some(l) = lang {
                    if t.target_lang != l {
                        return false;
                    }
                }
                if let Some(ref s) = status {
                    if t.status != *s {
                        return false;
                    }
                }
                true
            })
            .collect())
    }

    /// Count pending translations for a language
    async fn count_pending_for_lang(&self, lang: &str) -> usize {
        self.list_pending(Some(lang), Some(PendingStatus::Pending))
            .await
            .map(|v| v.len())
            .unwrap_or(0)
    }

    /// Approve a pending translation
    pub async fn approve_pending(
        &self,
        id: &str,
        admin_user: Option<String>,
    ) -> Result<(), AppError> {
        let mut pending_file = self.load_pending().await?;

        let idx = pending_file
            .translations
            .iter()
            .position(|t| t.id == id)
            .ok_or_else(|| AppError::NotFound {
                resource: format!("Pending translation: {}", id),
            })?;

        let mut translation = pending_file.translations.remove(idx);

        // Validate placeholders
        let validation = validate_placeholders(&translation.source_value, &translation.proposed_value);
        if !validation.valid {
            return Err(AppError::Validation {
                message: format!("Translation has invalid placeholders. Missing: {:?}", validation.missing),
                field: Some("proposed_value".to_string()),
                details: None,
            });
        }

        // Update status
        translation.status = PendingStatus::Approved;
        translation.reviewed_by = admin_user.clone();
        translation.reviewed_at = Some(chrono::Utc::now());

        // Apply to active locale
        let value = translation.edited_value.as_ref().unwrap_or(&translation.proposed_value);
        self.set_active_key_internal(&translation.target_lang, &translation.source_key, value).await?;

        // Save updated pending file
        self.save_pending(&pending_file).await?;

        // Record audit
        self.audit_log
            .record_approve(
                admin_user,
                &translation.target_lang,
                &translation.source_key,
                value,
                translation.source.clone(),
                translation.ai_model.clone(),
            )
            .await;

        info!(
            "Approved translation: {} -> {} ({})",
            translation.source_key, translation.target_lang, id
        );
        Ok(())
    }

    /// Reject a pending translation
    pub async fn reject_pending(
        &self,
        id: &str,
        reason: &str,
        admin_user: Option<String>,
    ) -> Result<(), AppError> {
        let mut pending_file = self.load_pending().await?;

        let translation = pending_file
            .translations
            .iter_mut()
            .find(|t| t.id == id)
            .ok_or_else(|| AppError::NotFound {
                resource: format!("Pending translation: {}", id),
            })?;

        translation.status = PendingStatus::Rejected;
        translation.reviewed_by = admin_user.clone();
        translation.reviewed_at = Some(chrono::Utc::now());
        translation.rejection_reason = Some(reason.to_string());

        // Extract values for audit before saving
        let target_lang = translation.target_lang.clone();
        let source_key = translation.source_key.clone();

        self.save_pending(&pending_file).await?;

        // Record audit
        self.audit_log
            .record_reject(admin_user, &target_lang, &source_key, reason)
            .await;

        info!("Rejected translation: {} ({})", id, reason);
        Ok(())
    }

    /// Edit and approve a pending translation
    pub async fn edit_pending(
        &self,
        id: &str,
        new_value: &str,
        admin_user: Option<String>,
    ) -> Result<(), AppError> {
        let mut pending_file = self.load_pending().await?;

        let idx = pending_file
            .translations
            .iter()
            .position(|t| t.id == id)
            .ok_or_else(|| AppError::NotFound {
                resource: format!("Pending translation: {}", id),
            })?;

        let mut translation = pending_file.translations.remove(idx);

        // Validate placeholders
        let validation = validate_placeholders(&translation.source_value, new_value);
        if !validation.valid {
            return Err(AppError::Validation {
                message: format!("Edited translation has invalid placeholders. Missing: {:?}", validation.missing),
                field: Some("value".to_string()),
                details: None,
            });
        }

        // Update
        translation.status = PendingStatus::Edited;
        translation.reviewed_by = admin_user.clone();
        translation.reviewed_at = Some(chrono::Utc::now());
        translation.edited_value = Some(new_value.to_string());

        // Apply to active locale
        self.set_active_key_internal(&translation.target_lang, &translation.source_key, new_value).await?;

        // Save updated pending file
        self.save_pending(&pending_file).await?;

        // Record audit
        self.audit_log
            .record_edit(
                admin_user,
                &translation.target_lang,
                &translation.source_key,
                Some(translation.proposed_value.clone()),
                new_value,
            )
            .await;

        info!(
            "Edited and approved translation: {} -> {} ({})",
            translation.source_key, translation.target_lang, id
        );
        Ok(())
    }

    /// Bulk approve pending translations
    pub async fn approve_pending_batch(
        &self,
        ids: &[String],
        admin_user: Option<String>,
    ) -> Result<usize, AppError> {
        let mut approved_count = 0;
        let mut pending_file = self.load_pending().await?;
        let mut to_apply: Vec<(String, String, String)> = Vec::new(); // (lang, key, value)

        for id in ids {
            if let Some(idx) = pending_file.translations.iter().position(|t| t.id == *id) {
                let translation = &pending_file.translations[idx];

                // Validate
                let validation = validate_placeholders(&translation.source_value, &translation.proposed_value);
                if validation.valid {
                    let value = translation.edited_value.as_ref().unwrap_or(&translation.proposed_value);
                    to_apply.push((
                        translation.target_lang.clone(),
                        translation.source_key.clone(),
                        value.clone(),
                    ));
                    approved_count += 1;
                }
            }
        }

        // Remove approved translations
        pending_file.translations.retain(|t| !ids.contains(&t.id));
        self.save_pending(&pending_file).await?;

        // Apply to active locales
        for (lang, key, value) in &to_apply {
            self.set_active_key_internal(lang, key, value).await?;
        }

        // Group by language for audit
        let mut by_lang: HashMap<String, usize> = HashMap::new();
        for (lang, _, _) in &to_apply {
            *by_lang.entry(lang.clone()).or_insert(0) += 1;
        }

        for (lang, count) in by_lang {
            self.audit_log
                .record_bulk_approve(admin_user.clone(), &lang, count, None)
                .await;
        }

        info!("Bulk approved {} translations", approved_count);
        Ok(approved_count)
    }

    // Internal helper to set key without audit (used by approve)
    async fn set_active_key_internal(
        &self,
        lang: &str,
        key: &str,
        value: &str,
    ) -> Result<(), AppError> {
        let mut locale = self.load_active(lang).await.unwrap_or_else(|_| serde_json::json!({}));
        set_nested_value(&mut locale, key, Value::String(value.to_string()));
        self.save_active(lang, &locale).await
    }

    /// Invalidate all caches
    pub async fn invalidate_cache(&self) {
        {
            let mut cache = self.cached_locales.write().await;
            cache.clear();
        }
        {
            let mut cache = self.cached_languages.write().await;
            *cache = None;
        }
        {
            let mut cache = self.cached_pending.write().await;
            *cache = None;
        }
        info!("Translation caches invalidated");
    }
}

// =========================================================================
// JSON helpers
// =========================================================================

/// Flatten nested JSON into dot-notation keys
fn flatten_json(value: &Value, prefix: &str) -> HashMap<String, Value> {
    let mut result = HashMap::new();

    match value {
        Value::Object(map) => {
            for (k, v) in map {
                let new_prefix = if prefix.is_empty() {
                    k.clone()
                } else {
                    format!("{}.{}", prefix, k)
                };

                if v.is_object() {
                    result.extend(flatten_json(v, &new_prefix));
                } else {
                    result.insert(new_prefix, v.clone());
                }
            }
        }
        _ => {
            if !prefix.is_empty() {
                result.insert(prefix.to_string(), value.clone());
            }
        }
    }

    result
}

/// Get a nested value from JSON using dot notation
fn get_nested_value<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    let parts: Vec<&str> = key.split('.').collect();
    let mut current = value;

    for part in parts {
        current = current.get(part)?;
    }

    Some(current)
}

/// Set a nested value in JSON using dot notation
fn set_nested_value(value: &mut Value, key: &str, new_value: Value) {
    let parts: Vec<&str> = key.split('.').collect();

    if parts.is_empty() {
        return;
    }

    let mut current = value;

    // Navigate/create path to parent
    for part in &parts[..parts.len() - 1] {
        if !current.is_object() {
            *current = serde_json::json!({});
        }
        current = current
            .as_object_mut()
            .unwrap()
            .entry(part.to_string())
            .or_insert_with(|| serde_json::json!({}));
    }

    // Set the final value
    if let Some(obj) = current.as_object_mut() {
        obj.insert(parts.last().unwrap().to_string(), new_value);
    }
}

/// Count total keys in a JSON value (recursive)
fn count_json_keys(value: &Value) -> usize {
    match value {
        Value::Object(map) => {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_flatten_json() {
        let json = serde_json::json!({
            "message": {
                "hello": "Hello",
                "nested": {
                    "deep": "Deep value"
                }
            },
            "top": "Top level"
        });

        let flat = flatten_json(&json, "");
        assert_eq!(flat.get("message.hello").unwrap(), "Hello");
        assert_eq!(flat.get("message.nested.deep").unwrap(), "Deep value");
        assert_eq!(flat.get("top").unwrap(), "Top level");
    }

    #[test]
    fn test_set_nested_value() {
        let mut json = serde_json::json!({});
        set_nested_value(&mut json, "a.b.c", Value::String("value".to_string()));

        assert_eq!(json["a"]["b"]["c"], "value");
    }

    #[test]
    fn test_get_nested_value() {
        let json = serde_json::json!({
            "a": {
                "b": {
                    "c": "value"
                }
            }
        });

        let value = get_nested_value(&json, "a.b.c");
        assert_eq!(value.unwrap(), "value");
    }
}
