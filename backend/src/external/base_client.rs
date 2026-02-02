//! Base HTTP client trait for external API clients
//!
//! Provides a generic implementation for common HTTP operations:
//! - GET/POST requests with consistent error handling
//! - Bearer token authentication
//! - URL building
//! - Response parsing
//!
//! Clients implement `ExternalApiClient` trait and get all HTTP methods for free.

use async_trait::async_trait;
use reqwest::{Client, Response};
use serde::{de::DeserializeOwned, Serialize};
use tracing::{debug, error};

use crate::error::AppError;

// ============================================================================
// External API Client Trait
// ============================================================================

/// Trait for external API clients
///
/// Implement this trait to get standardized HTTP methods with consistent
/// error handling, logging, and authentication.
///
/// # Example
///
/// ```ignore
/// pub struct MyApiClient {
///     client: Client,
///     base_url: String,
///     bearer_token: Option<String>,
/// }
///
/// impl ExternalApiClient for MyApiClient {
///     fn api_name(&self) -> &'static str { "MyAPI" }
///     fn base_url(&self) -> &str { &self.base_url }
///     fn client(&self) -> &Client { &self.client }
///     fn bearer_token(&self) -> Option<&str> { self.bearer_token.as_deref() }
/// }
///
/// // Now you can use:
/// // client.get("endpoint").await
/// // client.post("endpoint", &body).await
/// // client.get_with_query("endpoint", &[("key", "value")]).await
/// ```
#[async_trait]
pub trait ExternalApiClient: Send + Sync {
    /// Name of the API for error messages and logging
    fn api_name(&self) -> &'static str;

    /// Base URL for the API
    fn base_url(&self) -> &str;

    /// HTTP client instance
    fn client(&self) -> &Client;

    /// Optional bearer token for authentication
    fn bearer_token(&self) -> Option<&str> {
        None
    }

    /// Check if the client is configured (has valid base URL)
    #[allow(dead_code)]
    fn is_configured(&self) -> bool {
        !self.base_url().is_empty()
    }

    // ========================================================================
    // GET Requests
    // ========================================================================

    /// Make a GET request to an endpoint
    async fn get<T: DeserializeOwned>(&self, endpoint: &str) -> Result<T, AppError> {
        let url = self.build_url(endpoint);
        debug!("{}: GET {}", self.api_name(), url);

        let mut request = self.client().get(&url);
        if let Some(token) = self.bearer_token() {
            request = request.bearer_auth(token);
        }

        let response = request
            .send()
            .await
            .map_err(|e| self.request_error(endpoint, e))?;

        self.handle_response(response, endpoint).await
    }

    /// Make a GET request with query parameters
    async fn get_with_query<T: DeserializeOwned>(
        &self,
        endpoint: &str,
        params: &[(&str, &str)],
    ) -> Result<T, AppError> {
        let url = self.build_url_with_query(endpoint, params);
        debug!("{}: GET {}", self.api_name(), url);

        let mut request = self.client().get(&url);
        if let Some(token) = self.bearer_token() {
            request = request.bearer_auth(token);
        }

        let response = request
            .send()
            .await
            .map_err(|e| self.request_error(endpoint, e))?;

        self.handle_response(response, endpoint).await
    }

    /// Make a GET request with optional query parameters (skips None values)
    #[allow(dead_code)]
    async fn get_with_optional_query<T: DeserializeOwned>(
        &self,
        endpoint: &str,
        params: &[(&str, Option<&str>)],
    ) -> Result<T, AppError> {
        let url = self.build_url_with_optional_query(endpoint, params);
        debug!("{}: GET {}", self.api_name(), url);

        let mut request = self.client().get(&url);
        if let Some(token) = self.bearer_token() {
            request = request.bearer_auth(token);
        }

        let response = request
            .send()
            .await
            .map_err(|e| self.request_error(endpoint, e))?;

        self.handle_response(response, endpoint).await
    }

    // ========================================================================
    // POST Requests
    // ========================================================================

    /// Make a POST request with JSON body
    async fn post<T: DeserializeOwned, B: Serialize + Send + Sync>(
        &self,
        endpoint: &str,
        body: &B,
    ) -> Result<T, AppError> {
        let url = self.build_url(endpoint);
        debug!("{}: POST {}", self.api_name(), url);

        let mut request = self.client().post(&url).json(body);
        if let Some(token) = self.bearer_token() {
            request = request.bearer_auth(token);
        }

        let response = request
            .send()
            .await
            .map_err(|e| self.request_error(endpoint, e))?;

        self.handle_response(response, endpoint).await
    }

    /// Make a POST request without expecting a response body
    #[allow(dead_code)]
    async fn post_no_response<B: Serialize + Send + Sync>(
        &self,
        endpoint: &str,
        body: &B,
    ) -> Result<(), AppError> {
        let url = self.build_url(endpoint);
        debug!("{}: POST {}", self.api_name(), url);

        let mut request = self.client().post(&url).json(body);
        if let Some(token) = self.bearer_token() {
            request = request.bearer_auth(token);
        }

        let response = request
            .send()
            .await
            .map_err(|e| self.request_error(endpoint, e))?;

        self.check_status(response, endpoint).await?;
        Ok(())
    }

    // ========================================================================
    // Raw Response Methods (for special handling)
    // ========================================================================

    /// Make a GET request and return the raw response for custom handling
    #[allow(dead_code)]
    async fn get_raw(&self, endpoint: &str) -> Result<Response, AppError> {
        let url = self.build_url(endpoint);
        debug!("{}: GET {} (raw)", self.api_name(), url);

        let mut request = self.client().get(&url);
        if let Some(token) = self.bearer_token() {
            request = request.bearer_auth(token);
        }

        request
            .send()
            .await
            .map_err(|e| self.request_error(endpoint, e))
    }

    /// Make a POST request and return the raw response for custom handling
    async fn post_raw<B: Serialize + Send + Sync>(
        &self,
        endpoint: &str,
        body: &B,
    ) -> Result<Response, AppError> {
        let url = self.build_url(endpoint);
        debug!("{}: POST {} (raw)", self.api_name(), url);

        let mut request = self.client().post(&url).json(body);
        if let Some(token) = self.bearer_token() {
            request = request.bearer_auth(token);
        }

        request
            .send()
            .await
            .map_err(|e| self.request_error(endpoint, e))
    }

    // ========================================================================
    // URL Building
    // ========================================================================

    /// Build a full URL from an endpoint
    fn build_url(&self, endpoint: &str) -> String {
        format!("{}/{}", self.base_url().trim_end_matches('/'), endpoint)
    }

    /// Build a URL with query parameters
    fn build_url_with_query(&self, endpoint: &str, params: &[(&str, &str)]) -> String {
        let query: Vec<String> = params
            .iter()
            .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
            .collect();

        if query.is_empty() {
            self.build_url(endpoint)
        } else {
            format!("{}?{}", self.build_url(endpoint), query.join("&"))
        }
    }

    /// Build a URL with optional query parameters
    #[allow(dead_code)]
    fn build_url_with_optional_query(
        &self,
        endpoint: &str,
        params: &[(&str, Option<&str>)],
    ) -> String {
        let query: Vec<String> = params
            .iter()
            .filter_map(|(k, v)| v.map(|val| format!("{}={}", k, urlencoding::encode(val))))
            .collect();

        if query.is_empty() {
            self.build_url(endpoint)
        } else {
            format!("{}?{}", self.build_url(endpoint), query.join("&"))
        }
    }

    // ========================================================================
    // Response Handling
    // ========================================================================

    /// Handle response: check status and parse JSON
    async fn handle_response<T: DeserializeOwned>(
        &self,
        response: Response,
        context: &str,
    ) -> Result<T, AppError> {
        let response = self.check_status(response, context).await?;
        self.parse_json(response, context).await
    }

    /// Check response status and return error if not successful
    async fn check_status(&self, response: Response, context: &str) -> Result<Response, AppError> {
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            error!(
                "{} {} failed: {} - {}",
                self.api_name(),
                context,
                status,
                body
            );
            return Err(AppError::ExternalApi {
                api: self.api_name().to_string(),
                message: format!("{}: HTTP {} - {}", context, status, body),
            });
        }
        Ok(response)
    }

    /// Parse JSON response
    async fn parse_json<T: DeserializeOwned>(
        &self,
        response: Response,
        context: &str,
    ) -> Result<T, AppError> {
        response.json().await.map_err(|e| {
            error!("{} failed to parse {}: {}", self.api_name(), context, e);
            AppError::ExternalApi {
                api: self.api_name().to_string(),
                message: format!("Failed to parse {}: {}", context, e),
            }
        })
    }

    /// Create a request error
    fn request_error(&self, context: &str, error: reqwest::Error) -> AppError {
        error!(
            "{} {} request failed: {}",
            self.api_name(),
            context,
            error
        );
        AppError::ExternalApi {
            api: self.api_name().to_string(),
            message: format!("{}: {}", context, error),
        }
    }
}

// ============================================================================
// Wrapped Response Handling
// ============================================================================

/// Extension trait for handling wrapped API responses (e.g., { success: bool, data: T })
#[async_trait]
pub trait WrappedResponseExt<T> {
    /// Extract data from a wrapped response, or return an error
    fn extract_data(self, api_name: &str) -> Result<T, AppError>;
}

/// Generic wrapper for APIs that return { success: bool, data: T, error?: string }
#[derive(Debug, Clone, serde::Deserialize)]
pub struct ApiWrapper<T> {
    #[allow(dead_code)]
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> WrappedResponseExt<T> for ApiWrapper<T> {
    fn extract_data(self, api_name: &str) -> Result<T, AppError> {
        self.data.ok_or_else(|| AppError::ExternalApi {
            api: api_name.to_string(),
            message: self.error.unwrap_or_else(|| "Unknown error".to_string()),
        })
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    struct TestClient {
        base_url: String,
        bearer_token: Option<String>,
    }

    impl ExternalApiClient for TestClient {
        fn api_name(&self) -> &'static str {
            "TestAPI"
        }
        fn base_url(&self) -> &str {
            &self.base_url
        }
        fn client(&self) -> &Client {
            // In tests, we don't actually make requests
            static CLIENT: std::sync::OnceLock<Client> = std::sync::OnceLock::new();
            CLIENT.get_or_init(Client::new)
        }
        fn bearer_token(&self) -> Option<&str> {
            self.bearer_token.as_deref()
        }
    }

    #[test]
    fn test_build_url() {
        let client = TestClient {
            base_url: "https://api.example.com".to_string(),
            bearer_token: None,
        };
        assert_eq!(
            client.build_url("users"),
            "https://api.example.com/users"
        );
    }

    #[test]
    fn test_build_url_trailing_slash() {
        let client = TestClient {
            base_url: "https://api.example.com/".to_string(),
            bearer_token: None,
        };
        assert_eq!(
            client.build_url("users"),
            "https://api.example.com/users"
        );
    }

    #[test]
    fn test_build_url_with_query() {
        let client = TestClient {
            base_url: "https://api.example.com".to_string(),
            bearer_token: None,
        };
        let url = client.build_url_with_query("search", &[("q", "test"), ("limit", "10")]);
        assert!(url.contains("q=test"));
        assert!(url.contains("limit=10"));
    }

    #[test]
    fn test_build_url_with_optional_query() {
        let client = TestClient {
            base_url: "https://api.example.com".to_string(),
            bearer_token: None,
        };
        let url = client.build_url_with_optional_query(
            "search",
            &[("q", Some("test")), ("filter", None), ("limit", Some("10"))],
        );
        assert!(url.contains("q=test"));
        assert!(url.contains("limit=10"));
        assert!(!url.contains("filter"));
    }

    #[test]
    fn test_is_configured() {
        let configured = TestClient {
            base_url: "https://api.example.com".to_string(),
            bearer_token: None,
        };
        assert!(configured.is_configured());

        let not_configured = TestClient {
            base_url: "".to_string(),
            bearer_token: None,
        };
        assert!(!not_configured.is_configured());
    }

    #[test]
    fn test_api_wrapper_extract_data_success() {
        let wrapper: ApiWrapper<String> = ApiWrapper {
            success: true,
            data: Some("hello".to_string()),
            error: None,
        };
        assert_eq!(wrapper.extract_data("Test").unwrap(), "hello");
    }

    #[test]
    fn test_api_wrapper_extract_data_error() {
        let wrapper: ApiWrapper<String> = ApiWrapper {
            success: false,
            data: None,
            error: Some("Something went wrong".to_string()),
        };
        let err = wrapper.extract_data("Test").unwrap_err();
        match err {
            AppError::ExternalApi { api, message } => {
                assert_eq!(api, "Test");
                assert_eq!(message, "Something went wrong");
            }
            _ => panic!("Expected ExternalApi error"),
        }
    }
}
