//! HTTP utilities for reducing boilerplate in external API clients
//!
//! Provides common patterns for:
//! - Error handling with context
//! - Response parsing
//! - URL building

#![allow(dead_code)]

use reqwest::{Client, Response};
use serde::de::DeserializeOwned;
use tracing::{debug, error};

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
// HTTP Client Helpers
// ============================================================================

/// Fetch JSON from a URL with error handling
pub async fn fetch_json<T: DeserializeOwned>(
    client: &Client,
    url: &str,
    api_name: &str,
) -> Result<T, AppError> {
    debug!("{}: GET {}", api_name, url);

    client
        .get(url)
        .send()
        .await
        .with_context(api_name, "request")
        .await?
        .check_status(api_name, "response")
        .await?
        .parse_json(api_name, "body")
        .await
}

/// Fetch JSON with optional parameters
pub async fn fetch_json_with_query<T: DeserializeOwned, Q: serde::Serialize + ?Sized>(
    client: &Client,
    url: &str,
    query: &Q,
    api_name: &str,
) -> Result<T, AppError> {
    debug!("{}: GET {} (with query)", api_name, url);

    client
        .get(url)
        .query(query)
        .send()
        .await
        .with_context(api_name, "request")
        .await?
        .check_status(api_name, "response")
        .await?
        .parse_json(api_name, "body")
        .await
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

    /// Build a URL with path segments
    pub fn path(&self, segments: &[&str]) -> String {
        let path = segments.join("/");
        format!("{}/{}", self.base_url, path)
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

// ============================================================================
// Chain RPC Helpers
// ============================================================================

/// Extension trait for chain RPC responses
#[async_trait::async_trait]
pub trait ChainResponseExt {
    /// Check if response is successful and return chain-specific error
    async fn check_chain_status(self, chain: &str, context: &str) -> Result<Response, AppError>;

    /// Parse JSON response for chain queries
    async fn parse_chain_json<T: DeserializeOwned>(
        self,
        chain: &str,
        context: &str,
    ) -> Result<T, AppError>;
}

#[async_trait::async_trait]
impl ChainResponseExt for Response {
    async fn check_chain_status(self, chain: &str, context: &str) -> Result<Response, AppError> {
        if !self.status().is_success() {
            let status = self.status();
            let body = self.text().await.unwrap_or_default();
            error!("Chain {} {} failed: {} - {}", chain, context, status, body);
            return Err(AppError::ChainRpc {
                chain: chain.to_string(),
                message: format!("{}: HTTP {} - {}", context, status, body),
            });
        }
        Ok(self)
    }

    async fn parse_chain_json<T: DeserializeOwned>(
        self,
        chain: &str,
        context: &str,
    ) -> Result<T, AppError> {
        self.json().await.map_err(|e| {
            error!("Chain {} failed to parse {}: {}", chain, context, e);
            AppError::ChainRpc {
                chain: chain.to_string(),
                message: format!("Failed to parse {}: {}", context, e),
            }
        })
    }
}

/// Extension trait for chain request results
#[async_trait::async_trait]
pub trait ChainRequestResultExt {
    /// Add chain error context
    async fn with_chain_context(self, chain: &str, context: &str) -> Result<Response, AppError>;
}

#[async_trait::async_trait]
impl ChainRequestResultExt for Result<Response, reqwest::Error> {
    async fn with_chain_context(self, chain: &str, context: &str) -> Result<Response, AppError> {
        self.map_err(|e| {
            error!("Chain {} {} request failed: {}", chain, context, e);
            AppError::ChainRpc {
                chain: chain.to_string(),
                message: format!("{}: {}", context, e),
            }
        })
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
    fn test_url_builder_path() {
        let builder = UrlBuilder::new("https://api.example.com");
        assert_eq!(
            builder.path(&["v1", "users", "123"]),
            "https://api.example.com/v1/users/123"
        );
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
