//! HTTP utilities for reducing boilerplate in external API clients
//!
//! Provides common patterns for:
//! - Error handling with context
//! - Response parsing
//! - URL building

use reqwest::Response;
use serde::de::DeserializeOwned;
use tracing::error;

use crate::error::AppError;

// ============================================================================
// HTTP Error Handling Trait
// ============================================================================

/// Extension trait for handling HTTP responses with consistent error handling
#[async_trait::async_trait]
pub trait ResponseExt {
    /// Check if response is successful and return appropriate error if not
    async fn check_status(self, api_name: &str, context: &str) -> Result<Response, AppError>;

    /// Parse JSON response with error context
    async fn parse_json<T: DeserializeOwned>(
        self,
        api_name: &str,
        context: &str,
    ) -> Result<T, AppError>;
}

#[async_trait::async_trait]
impl ResponseExt for Response {
    async fn check_status(self, api_name: &str, context: &str) -> Result<Response, AppError> {
        if !self.status().is_success() {
            let status = self.status();
            let body = self.text().await.unwrap_or_default();
            error!("{} {} failed: {} - {}", api_name, context, status, body);
            return Err(AppError::ExternalApi {
                api: api_name.to_string(),
                message: format!("{}: HTTP {} - {}", context, status, body),
            });
        }
        Ok(self)
    }

    async fn parse_json<T: DeserializeOwned>(
        self,
        api_name: &str,
        context: &str,
    ) -> Result<T, AppError> {
        self.json().await.map_err(|e| {
            error!("{} failed to parse {}: {}", api_name, context, e);
            AppError::ExternalApi {
                api: api_name.to_string(),
                message: format!("Failed to parse {}: {}", context, e),
            }
        })
    }
}

/// Extension trait for Result<Response, reqwest::Error> to add context
#[async_trait::async_trait]
pub trait RequestResultExt {
    /// Add error context to a request result
    async fn with_context(self, api_name: &str, context: &str) -> Result<Response, AppError>;
}

#[async_trait::async_trait]
impl RequestResultExt for Result<Response, reqwest::Error> {
    async fn with_context(self, api_name: &str, context: &str) -> Result<Response, AppError> {
        self.map_err(|e| {
            error!("{} {} request failed: {}", api_name, context, e);
            AppError::ExternalApi {
                api: api_name.to_string(),
                message: format!("{}: {}", context, e),
            }
        })
    }
}

// ============================================================================
// URL Builder
// ============================================================================

/// URL builder for constructing API endpoints
pub struct UrlBuilder {
    base_url: String,
}

impl UrlBuilder {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
        }
    }

    /// Build a URL with a single path segment
    pub fn endpoint(&self, endpoint: &str) -> String {
        format!("{}/{}", self.base_url, endpoint)
    }

    /// Build a URL with query parameters
    pub fn with_query(&self, endpoint: &str, params: &[(&str, &str)]) -> String {
        let query: Vec<String> = params
            .iter()
            .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
            .collect();

        if query.is_empty() {
            self.endpoint(endpoint)
        } else {
            format!("{}?{}", self.endpoint(endpoint), query.join("&"))
        }
    }

    /// Build a URL with optional query parameters (skips None values)
    pub fn with_optional_query(&self, endpoint: &str, params: &[(&str, Option<&str>)]) -> String {
        let query: Vec<String> = params
            .iter()
            .filter_map(|(k, v)| v.map(|val| format!("{}={}", k, urlencoding::encode(val))))
            .collect();

        if query.is_empty() {
            self.endpoint(endpoint)
        } else {
            format!("{}?{}", self.endpoint(endpoint), query.join("&"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_url_builder_endpoint() {
        let builder = UrlBuilder::new("https://api.example.com");
        assert_eq!(builder.endpoint("prices"), "https://api.example.com/prices");
    }

    #[test]
    fn test_url_builder_with_query() {
        let builder = UrlBuilder::new("https://api.example.com");
        let url = builder.with_query("search", &[("q", "test"), ("limit", "10")]);
        assert!(url.contains("q=test"));
        assert!(url.contains("limit=10"));
    }

    #[test]
    fn test_url_builder_with_optional_query() {
        let builder = UrlBuilder::new("https://api.example.com");
        let url = builder.with_optional_query(
            "search",
            &[("q", Some("test")), ("filter", None), ("limit", Some("10"))],
        );
        assert!(url.contains("q=test"));
        assert!(url.contains("limit=10"));
        assert!(!url.contains("filter"));
    }

    #[test]
    fn test_url_builder_encodes_special_chars() {
        let builder = UrlBuilder::new("https://api.example.com");
        let url = builder.with_query("search", &[("q", "hello world")]);
        assert!(url.contains("q=hello%20world"));
    }
}
