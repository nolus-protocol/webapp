//! Test-only helpers for constructing minimal AppState instances and
//! reading axum response bodies in integration tests.
//!
//! Gated `#[cfg(test)]` — never compiled in release builds.
//! Keep this file LEAN. Phase 0 deleted 433 LOC of unused factory code;
//! only add what's actively used.

#![cfg(test)]

use std::sync::Arc;
use std::time::Instant;

use axum::response::Response;
use http_body_util::BodyExt;

use crate::config::{AdminConfig, AppConfig, ExternalApiConfig, ProtocolsConfig, ServerConfig};
use crate::config_store::ConfigStore;
use crate::data_cache::AppDataCache;
use crate::external;
use crate::handlers::websocket::WebSocketManager;
use crate::translations::{
    llm::{LlmClient, LlmConfig},
    TranslationStorage,
};
use crate::AppState;

/// Minimal AppConfig with safe defaults: admin disabled, `127.0.0.1:1` stub
/// URLs for every external API (unroutable — no DNS, fast fail), no CORS.
pub fn test_config() -> AppConfig {
    AppConfig {
        server: ServerConfig {
            host: "127.0.0.1".to_string(),
            port: 0,
            cors_origins: None,
        },
        external: ExternalApiConfig {
            etl_api_url: "http://127.0.0.1:1/".to_string(),
            skip_api_url: "http://127.0.0.1:1/".to_string(),
            skip_api_key: None,
            nolus_rpc_url: "http://127.0.0.1:1/".to_string(),
            nolus_rest_url: "http://127.0.0.1:1/".to_string(),
            referral_api_url: "http://127.0.0.1:1/".to_string(),
            referral_api_token: "stub".to_string(),
            zero_interest_api_url: "http://127.0.0.1:1/".to_string(),
            zero_interest_api_token: "stub".to_string(),
            intercom_app_id: "stub".to_string(),
            intercom_secret_key: "stub".to_string(),
        },
        admin: AdminConfig {
            enabled: false,
            api_key: String::new(),
        },
        protocols: ProtocolsConfig::default(),
    }
}

/// Config helper for admin middleware tests.
pub fn test_config_with_admin(enabled: bool, api_key: &str) -> AppConfig {
    let mut c = test_config();
    c.admin.enabled = enabled;
    c.admin.api_key = api_key.to_string();
    c
}

/// Default minimal AppState (admin disabled).
pub async fn test_app_state() -> Arc<AppState> {
    test_app_state_with_config(test_config()).await
}

/// Build an AppState with the given config. All external clients are
/// constructed with unroutable `127.0.0.1:1` stub URLs — tests must never
/// trigger actual HTTP calls on this state. Tempdirs backing ConfigStore /
/// TranslationStorage are kept alive via `TempDir::keep()` (no
/// `mem::forget`), so the paths persist for the test binary's lifetime.
pub async fn test_app_state_with_config(config: AppConfig) -> Arc<AppState> {
    // 1ms timeout is fine here: stub URLs resolve to 127.0.0.1 (no DNS),
    // and tests must never actually issue HTTP calls on this state.
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(1))
        .build()
        .expect("reqwest client builder cannot fail with only a timeout set");

    let etl_client =
        external::etl::EtlClient::new(config.external.etl_api_url.clone(), http_client.clone());
    let skip_client = external::skip::SkipClient::new(
        config.external.skip_api_url.clone(),
        config.external.skip_api_key.clone(),
        http_client.clone(),
    );
    let chain_client = external::chain::ChainClient::new(
        config.external.nolus_rest_url.clone(),
        http_client.clone(),
    );
    let referral_client = external::referral::ReferralClient::new(&config, http_client.clone());
    let zero_interest_client =
        external::zero_interest::ZeroInterestClient::new(&config, http_client.clone());

    // ConfigStore + TranslationStorage need real directories. Use tempdirs
    // and leak the guard via `TempDir::keep()` so the dir survives for the
    // lifetime of the test binary (AppState clones outlive the test fn).
    let config_dir = tempfile::tempdir().expect("tempdir for ConfigStore").keep();
    let config_store = ConfigStore::new(&config_dir);
    config_store
        .init()
        .await
        .expect("ConfigStore init failed in test_utils");

    let translation_dir = tempfile::tempdir()
        .expect("tempdir for TranslationStorage")
        .keep();
    let translation_storage = TranslationStorage::new(&translation_dir);
    translation_storage
        .init()
        .await
        .expect("TranslationStorage init failed in test_utils");

    let llm_client = LlmClient::new(LlmConfig {
        api_key: String::new(),
        model: "stub".to_string(),
        base_url: Some("http://127.0.0.1:1/".to_string()),
    });

    Arc::new(AppState {
        config,
        etl_client,
        skip_client,
        chain_client,
        referral_client,
        zero_interest_client,
        data_cache: AppDataCache::new(),
        ws_manager: WebSocketManager::new(16),
        config_store,
        translation_storage,
        llm_client,
        startup_time: Instant::now(),
    })
}

/// Collect an axum response body to bytes.
pub async fn collect_body(resp: Response) -> Vec<u8> {
    resp.into_body()
        .collect()
        .await
        .expect("response body collection failed")
        .to_bytes()
        .to_vec()
}

/// Convenience: collect and UTF-8 decode.
pub async fn collect_body_str(resp: Response) -> String {
    String::from_utf8(collect_body(resp).await).expect("response body not valid UTF-8")
}

#[cfg(test)]
mod smoke {
    use super::*;

    #[tokio::test]
    async fn test_utils_factory_produces_valid_app_state() {
        let state = test_app_state().await;
        assert!(!state.config.admin.enabled);
        assert_eq!(state.config.admin.api_key, "");
    }

    #[tokio::test]
    async fn test_utils_factory_with_admin_enabled() {
        let state = test_app_state_with_config(test_config_with_admin(true, "secret123")).await;
        assert!(state.config.admin.enabled);
        assert_eq!(state.config.admin.api_key, "secret123");
    }

    #[tokio::test]
    async fn collect_body_reads_bytes() {
        use axum::response::IntoResponse;
        let resp = "hello".into_response();
        let body = collect_body(resp).await;
        assert_eq!(body, b"hello");
    }
}
