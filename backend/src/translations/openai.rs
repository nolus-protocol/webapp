//! OpenAI API client for AI-powered translation generation
//!
//! Handles batch translation requests with context and glossary support.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, error, info, warn};

use super::types::GlossaryConfig;
use super::validation::extract_placeholders;
use crate::error::AppError;

/// OpenAI API client for translations
#[derive(Debug, Clone)]
pub struct OpenAIClient {
    client: Client,
    api_key: String,
    model: String,
    base_url: String,
}

/// Configuration for OpenAI client
#[derive(Debug, Clone)]
pub struct OpenAIConfig {
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
}

impl Default for OpenAIConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: "gpt-4o-mini".to_string(),
            base_url: None,
        }
    }
}

// =========================================================================
// OpenAI API Types
// =========================================================================

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    response_format: ResponseFormat,
}

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ResponseFormat {
    #[serde(rename = "type")]
    format_type: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
    usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

// =========================================================================
// Translation Types
// =========================================================================

/// Input for a translation request
#[derive(Debug, Clone)]
pub struct TranslationInput {
    pub key: String,
    pub value: String,
    pub placeholders: Vec<String>,
}

/// Result of a single translation
#[derive(Debug, Clone)]
pub struct TranslationOutput {
    pub key: String,
    pub source_value: String,
    pub translated_value: String,
    pub placeholders_valid: bool,
}

/// Batch translation result
#[derive(Debug, Clone)]
pub struct BatchTranslationResult {
    pub translations: Vec<TranslationOutput>,
    pub failed_keys: Vec<String>,
    pub tokens_used: u32,
}

/// Expected JSON structure from OpenAI
#[derive(Debug, Deserialize)]
struct TranslationResponse {
    translations: Vec<TranslationItem>,
}

#[derive(Debug, Deserialize)]
struct TranslationItem {
    key: String,
    translation: String,
}

impl OpenAIClient {
    /// Create a new OpenAI client
    pub fn new(config: OpenAIConfig) -> Self {
        Self {
            client: Client::new(),
            api_key: config.api_key,
            model: config.model,
            base_url: config
                .base_url
                .unwrap_or_else(|| "https://api.openai.com/v1".to_string()),
        }
    }

    /// Check if the client is configured with a valid API key
    pub fn is_configured(&self) -> bool {
        !self.api_key.is_empty()
    }

    /// Get the model being used
    pub fn model(&self) -> &str {
        &self.model
    }

    /// Translate a batch of keys from source to target language
    pub async fn translate_batch(
        &self,
        source_lang: &str,
        target_lang: &str,
        inputs: &[TranslationInput],
        context: Option<&str>,
        glossary: Option<&GlossaryConfig>,
    ) -> Result<BatchTranslationResult, AppError> {
        if inputs.is_empty() {
            return Ok(BatchTranslationResult {
                translations: vec![],
                failed_keys: vec![],
                tokens_used: 0,
            });
        }

        if !self.is_configured() {
            return Err(AppError::Internal(
                "OpenAI API key not configured".to_string(),
            ));
        }

        let system_prompt = self.build_system_prompt(source_lang, target_lang, context, glossary);
        let user_prompt = self.build_user_prompt(inputs);

        debug!(
            "Translating {} keys from {} to {}",
            inputs.len(),
            source_lang,
            target_lang
        );

        let request = ChatCompletionRequest {
            model: self.model.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt,
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_prompt,
                },
            ],
            temperature: 0.3, // Lower temperature for more consistent translations
            response_format: ResponseFormat {
                format_type: "json_object".to_string(),
            },
        };

        let response = self
            .client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::ExternalApi {
                api: "OpenAI".to_string(),
                message: format!("Request failed: {}", e),
            })?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("OpenAI API error: {} - {}", status, error_text);
            return Err(AppError::ExternalApi {
                api: "OpenAI".to_string(),
                message: format!("API returned {}: {}", status, error_text),
            });
        }

        let completion: ChatCompletionResponse =
            response.json().await.map_err(|e| AppError::ExternalApi {
                api: "OpenAI".to_string(),
                message: format!("Failed to parse response: {}", e),
            })?;

        let tokens_used = completion
            .usage
            .map(|u| u.total_tokens)
            .unwrap_or(0);

        let content = completion
            .choices
            .first()
            .map(|c| &c.message.content)
            .ok_or_else(|| AppError::ExternalApi {
                api: "OpenAI".to_string(),
                message: "No response content".to_string(),
            })?;

        self.parse_translations(content, inputs, tokens_used)
    }

    /// Build the system prompt for translation
    fn build_system_prompt(
        &self,
        source_lang: &str,
        target_lang: &str,
        context: Option<&str>,
        glossary: Option<&GlossaryConfig>,
    ) -> String {
        let mut prompt = format!(
            r#"You are a professional translator specializing in translating UI text for a DeFi (decentralized finance) application.

Your task is to translate text from {source_lang} to {target_lang}.

CRITICAL RULES:
1. PRESERVE ALL PLACEHOLDERS EXACTLY - Do not translate or modify placeholders like {{name}}, {{0}}, {{{{count}}}}, %s, %d
2. Maintain the same tone and formality as the source text
3. Keep translations concise - these are for UI elements
4. Preserve any technical terms according to the glossary
5. Output ONLY valid JSON in the format specified"#,
            source_lang = get_language_name(source_lang),
            target_lang = get_language_name(target_lang),
        );

        if let Some(ctx) = context {
            prompt.push_str(&format!(
                r#"

APPLICATION CONTEXT:
{}
"#,
                ctx
            ));
        }

        if let Some(g) = glossary {
            if !g.terms.is_empty() {
                prompt.push_str("\n\nGLOSSARY (do not translate these terms):\n");
                for (term, note) in &g.terms {
                    if note.is_empty() {
                        prompt.push_str(&format!("- {}\n", term));
                    } else {
                        prompt.push_str(&format!("- {} ({})\n", term, note));
                    }
                }
            }
        }

        prompt.push_str(
            r#"

OUTPUT FORMAT:
Respond with a JSON object containing a "translations" array. Each item must have:
- "key": the original key (unchanged)
- "translation": the translated text

Example:
{
  "translations": [
    { "key": "message.hello", "translation": "Translated text" }
  ]
}"#,
        );

        prompt
    }

    /// Build the user prompt with keys to translate
    fn build_user_prompt(&self, inputs: &[TranslationInput]) -> String {
        let mut prompt = String::from("Translate the following keys:\n\n");

        for input in inputs {
            prompt.push_str(&format!(
                "Key: {}\nText: {}\n",
                input.key, input.value
            ));
            if !input.placeholders.is_empty() {
                prompt.push_str(&format!(
                    "Placeholders to preserve: {}\n",
                    input.placeholders.join(", ")
                ));
            }
            prompt.push('\n');
        }

        prompt
    }

    /// Parse the OpenAI response into translation results
    fn parse_translations(
        &self,
        content: &str,
        inputs: &[TranslationInput],
        tokens_used: u32,
    ) -> Result<BatchTranslationResult, AppError> {
        // Build a map of expected keys for lookup
        let input_map: HashMap<&str, &TranslationInput> =
            inputs.iter().map(|i| (i.key.as_str(), i)).collect();

        // Parse JSON response
        let response: TranslationResponse =
            serde_json::from_str(content).map_err(|e| {
                error!("Failed to parse OpenAI response: {}", e);
                error!("Raw content: {}", content);
                AppError::ExternalApi {
                    api: "OpenAI".to_string(),
                    message: format!("Invalid JSON response: {}", e),
                }
            })?;

        let mut translations = Vec::new();
        let mut processed_keys: std::collections::HashSet<String> = std::collections::HashSet::new();

        for item in response.translations {
            if let Some(input) = input_map.get(item.key.as_str()) {
                processed_keys.insert(item.key.clone());

                // Validate placeholders
                let translated_placeholders = extract_placeholders(&item.translation);
                let placeholders_valid = input
                    .placeholders
                    .iter()
                    .all(|p| translated_placeholders.contains(p));

                if !placeholders_valid {
                    warn!(
                        "Translation for key '{}' has invalid placeholders. Expected: {:?}, Got: {:?}",
                        item.key, input.placeholders, translated_placeholders
                    );
                }

                translations.push(TranslationOutput {
                    key: item.key,
                    source_value: input.value.clone(),
                    translated_value: item.translation,
                    placeholders_valid,
                });
            } else {
                warn!("OpenAI returned unexpected key: {}", item.key);
            }
        }

        // Track any keys that weren't translated
        let failed_keys: Vec<String> = inputs
            .iter()
            .filter(|i| !processed_keys.contains(&i.key))
            .map(|i| i.key.clone())
            .collect();

        if !failed_keys.is_empty() {
            warn!("Some keys were not translated: {:?}", failed_keys);
        }

        info!(
            "Translated {}/{} keys, {} tokens used",
            translations.len(),
            inputs.len(),
            tokens_used
        );

        Ok(BatchTranslationResult {
            translations,
            failed_keys,
            tokens_used,
        })
    }
}

/// Get human-readable language name from code
fn get_language_name(code: &str) -> &'static str {
    match code {
        "en" => "English",
        "ru" => "Russian",
        "cn" | "zh" => "Chinese (Simplified)",
        "fr" => "French",
        "es" => "Spanish",
        "gr" | "el" => "Greek",
        "tr" => "Turkish",
        "id" => "Indonesian",
        "jp" | "ja" => "Japanese",
        "kr" | "ko" => "Korean",
        "de" => "German",
        "pt" => "Portuguese",
        "it" => "Italian",
        "nl" => "Dutch",
        "pl" => "Polish",
        "vi" => "Vietnamese",
        "th" => "Thai",
        "ar" => "Arabic",
        "hi" => "Hindi",
        _ => "Unknown",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_language_name() {
        assert_eq!(get_language_name("en"), "English");
        assert_eq!(get_language_name("ru"), "Russian");
        assert_eq!(get_language_name("cn"), "Chinese (Simplified)");
        assert_eq!(get_language_name("xyz"), "Unknown");
    }

    #[test]
    fn test_client_not_configured() {
        let client = OpenAIClient::new(OpenAIConfig::default());
        assert!(!client.is_configured());
    }

    #[test]
    fn test_client_configured() {
        let client = OpenAIClient::new(OpenAIConfig {
            api_key: "test-key".to_string(),
            model: "gpt-4o-mini".to_string(),
            base_url: None,
        });
        assert!(client.is_configured());
        assert_eq!(client.model(), "gpt-4o-mini");
    }

    #[test]
    fn test_build_system_prompt_basic() {
        let client = OpenAIClient::new(OpenAIConfig::default());
        let prompt = client.build_system_prompt("en", "ru", None, None);

        assert!(prompt.contains("English"));
        assert!(prompt.contains("Russian"));
        assert!(prompt.contains("PRESERVE ALL PLACEHOLDERS"));
        assert!(prompt.contains("JSON"));
    }

    #[test]
    fn test_build_system_prompt_with_context() {
        let client = OpenAIClient::new(OpenAIConfig::default());
        let prompt = client.build_system_prompt(
            "en",
            "fr",
            Some("This is a DeFi application for trading."),
            None,
        );

        assert!(prompt.contains("APPLICATION CONTEXT"));
        assert!(prompt.contains("DeFi application for trading"));
    }

    #[test]
    fn test_build_system_prompt_with_glossary() {
        let client = OpenAIClient::new(OpenAIConfig::default());
        let mut glossary = GlossaryConfig::default();
        glossary
            .terms
            .insert("Nolus".to_string(), "".to_string());
        glossary
            .terms
            .insert("NLS".to_string(), "Native token".to_string());

        let prompt = client.build_system_prompt("en", "es", None, Some(&glossary));

        assert!(prompt.contains("GLOSSARY"));
        assert!(prompt.contains("Nolus"));
        assert!(prompt.contains("NLS"));
        assert!(prompt.contains("Native token"));
    }

    #[test]
    fn test_build_user_prompt() {
        let client = OpenAIClient::new(OpenAIConfig::default());
        let inputs = vec![
            TranslationInput {
                key: "message.hello".to_string(),
                value: "Hello {name}!".to_string(),
                placeholders: vec!["{name}".to_string()],
            },
            TranslationInput {
                key: "message.goodbye".to_string(),
                value: "Goodbye".to_string(),
                placeholders: vec![],
            },
        ];

        let prompt = client.build_user_prompt(&inputs);

        assert!(prompt.contains("Key: message.hello"));
        assert!(prompt.contains("Text: Hello {name}!"));
        assert!(prompt.contains("Placeholders to preserve: {name}"));
        assert!(prompt.contains("Key: message.goodbye"));
        assert!(prompt.contains("Text: Goodbye"));
    }

    #[test]
    fn test_parse_translations_success() {
        let client = OpenAIClient::new(OpenAIConfig::default());
        let inputs = vec![
            TranslationInput {
                key: "message.hello".to_string(),
                value: "Hello {name}!".to_string(),
                placeholders: vec!["{name}".to_string()],
            },
        ];

        let json_content = r#"{
            "translations": [
                { "key": "message.hello", "translation": "Привет {name}!" }
            ]
        }"#;

        let result = client.parse_translations(json_content, &inputs, 100).unwrap();

        assert_eq!(result.translations.len(), 1);
        assert_eq!(result.translations[0].key, "message.hello");
        assert_eq!(result.translations[0].translated_value, "Привет {name}!");
        assert!(result.translations[0].placeholders_valid);
        assert!(result.failed_keys.is_empty());
        assert_eq!(result.tokens_used, 100);
    }

    #[test]
    fn test_parse_translations_missing_placeholder() {
        let client = OpenAIClient::new(OpenAIConfig::default());
        let inputs = vec![TranslationInput {
            key: "message.hello".to_string(),
            value: "Hello {name}!".to_string(),
            placeholders: vec!["{name}".to_string()],
        }];

        let json_content = r#"{
            "translations": [
                { "key": "message.hello", "translation": "Привет!" }
            ]
        }"#;

        let result = client.parse_translations(json_content, &inputs, 100).unwrap();

        assert_eq!(result.translations.len(), 1);
        assert!(!result.translations[0].placeholders_valid);
    }

    #[test]
    fn test_parse_translations_missing_key() {
        let client = OpenAIClient::new(OpenAIConfig::default());
        let inputs = vec![
            TranslationInput {
                key: "message.hello".to_string(),
                value: "Hello".to_string(),
                placeholders: vec![],
            },
            TranslationInput {
                key: "message.goodbye".to_string(),
                value: "Goodbye".to_string(),
                placeholders: vec![],
            },
        ];

        let json_content = r#"{
            "translations": [
                { "key": "message.hello", "translation": "Привет" }
            ]
        }"#;

        let result = client.parse_translations(json_content, &inputs, 100).unwrap();

        assert_eq!(result.translations.len(), 1);
        assert_eq!(result.failed_keys, vec!["message.goodbye"]);
    }

    #[test]
    fn test_parse_translations_invalid_json() {
        let client = OpenAIClient::new(OpenAIConfig::default());
        let inputs = vec![TranslationInput {
            key: "message.hello".to_string(),
            value: "Hello".to_string(),
            placeholders: vec![],
        }];

        let result = client.parse_translations("not valid json", &inputs, 100);
        assert!(result.is_err());
    }
}
