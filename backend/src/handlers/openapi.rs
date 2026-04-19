//! OpenAPI specification aggregator
//!
//! Exposes the backend's public REST surface as an OpenAPI 3.1 document at
//! `GET /api/openapi.json`. The spec covers unauthenticated read and write
//! routes; admin endpoints gated by `admin_auth_middleware` are intentionally
//! omitted to avoid advertising the admin surface publicly.
//!
//! This module is grown incrementally: as each handler file is annotated with
//! `#[utoipa::path]`, its functions are added to the `paths(...)` list below.

use axum::Json;
use utoipa::OpenApi;

use crate::error::{ErrorBody, ErrorResponse};
use crate::handlers::{common_types, config};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Nolus Protocol Webapp API",
        description = "Public REST API backing app.nolus.io. Read endpoints are cached and free to call; write endpoints return unsigned transaction payloads for client-side signing.",
        version = "1.0.0",
        contact(name = "Nolus Protocol", url = "https://nolus.io/"),
        license(name = "Apache-2.0"),
    ),
    servers(
        (url = "https://app.nolus.io", description = "Production"),
        (url = "https://app-dev.nolus.io", description = "Staging"),
    ),
    paths(
        config::get_config,
        config::get_protocols,
        config::get_networks,
    ),
    components(schemas(
        ErrorResponse,
        ErrorBody,
        config::AppConfigResponse,
        config::ProtocolInfo,
        config::NetworkInfo,
        config::NativeAssetInfo,
        config::ContractsInfo,
        common_types::ProtocolContracts,
        common_types::CurrencyDisplayInfo,
    )),
    tags(
        (name = "config", description = "Application configuration (protocols, networks, contracts)"),
    ),
)]
pub struct ApiDoc;

/// Serve the OpenAPI document as JSON.
pub async fn serve_openapi() -> Json<utoipa::openapi::OpenApi> {
    Json(ApiDoc::openapi())
}

#[cfg(test)]
mod tests {
    //! Snapshot test: the generated OpenAPI document is compared against the
    //! committed `openapi.snapshot.json`. Any unreviewed drift fails the test,
    //! so the spec cannot change without an explicit snapshot update:
    //!
    //!     UPDATE_OPENAPI_SNAPSHOT=1 cargo test openapi
    //!
    //! The snapshot doubles as reviewable payload for `/api/openapi.json`.

    use super::ApiDoc;
    use std::path::PathBuf;
    use utoipa::OpenApi;

    fn snapshot_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("openapi.snapshot.json")
    }

    fn render_current_spec() -> String {
        let spec = ApiDoc::openapi();
        let mut out = serde_json::to_string_pretty(&spec).expect("spec serializes");
        out.push('\n');
        out
    }

    #[test]
    fn openapi_spec_matches_snapshot() {
        let current = render_current_spec();
        let path = snapshot_path();

        if std::env::var("UPDATE_OPENAPI_SNAPSHOT").is_ok() {
            std::fs::write(&path, &current).expect("write snapshot");
            return;
        }

        let expected = std::fs::read_to_string(&path).expect(
            "openapi.snapshot.json must exist — run with UPDATE_OPENAPI_SNAPSHOT=1 to create it",
        );

        if expected != current {
            panic!(
                "OpenAPI spec drifted from committed snapshot at {}.\n\n\
                 If the change is intentional, regenerate the snapshot:\n\n    \
                 UPDATE_OPENAPI_SNAPSHOT=1 cargo test openapi\n\n\
                 Then commit the updated file.",
                path.display()
            );
        }
    }

    #[test]
    fn openapi_spec_has_no_admin_routes() {
        let spec = ApiDoc::openapi();
        let paths: Vec<&String> = spec.paths.paths.keys().collect();
        let admin_paths: Vec<_> = paths
            .iter()
            .filter(|p| p.starts_with("/api/admin") || p.contains("/gated/"))
            .collect();

        assert!(
            admin_paths.is_empty(),
            "public OpenAPI spec must not include admin routes, found: {:?}",
            admin_paths
        );
    }
}
