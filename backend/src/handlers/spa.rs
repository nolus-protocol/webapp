//! SPA (Single Page Application) fallback handler
//!
//! This module provides a fallback service that serves static files from a directory,
//! but falls back to index.html with a 200 OK status for client-side routing.

use axum::{
    body::Body,
    http::{Request, Response, StatusCode, Uri},
};
use std::convert::Infallible;
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use tower::Service;
use tower_http::services::ServeDir;

/// Creates a SPA fallback service that serves static files from the given directory,
/// falling back to index.html with 200 OK for client-side routes.
pub fn create_spa_fallback(static_dir: String, _index_path: String) -> SpaFallback {
    SpaFallback {
        serve_dir: ServeDir::new(&static_dir),
        static_dir,
    }
}

/// SPA fallback service that wraps ServeDir and falls back to index.html
#[derive(Clone)]
pub struct SpaFallback {
    serve_dir: ServeDir,
    static_dir: String,
}

impl Service<Request<Body>> for SpaFallback {
    type Response = Response<Body>;
    type Error = Infallible;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        <ServeDir as Service<Request<Body>>>::poll_ready(&mut self.serve_dir, cx)
            .map_err(|_| unreachable!())
    }

    fn call(&mut self, req: Request<Body>) -> Self::Future {
        let mut serve_dir = self.serve_dir.clone();
        let static_dir = self.static_dir.clone();

        Box::pin(async move {
            // Try to serve the static file first
            let response = serve_dir
                .call(req)
                .await
                .expect("ServeDir::Error is Infallible; cannot fail");

            // If the file was not found (404) or ServeDir is trying to
            // redirect to a directory with a trailing slash (3xx), serve
            // index.html instead. ServeDir uses 307 for directory redirects
            // in tower-http 0.6; catching all redirects avoids breakage if
            // a future version changes the status code. Without this, nginx
            // stripping trailing slashes causes an infinite loop:
            //   /assets → 307 /assets/ → nginx 301 /assets → …
            if response.status() == StatusCode::NOT_FOUND || response.status().is_redirection() {
                // Create a new request for index.html
                let index_req = Request::builder()
                    .uri(Uri::from_static("/index.html"))
                    .body(Body::empty())
                    .expect("static /index.html URI and empty body are always valid");

                // Create a new ServeDir to serve index.html
                let mut index_serve = ServeDir::new(&static_dir);
                let index_response = index_serve
                    .call(index_req)
                    .await
                    .expect("ServeDir::Error is Infallible; cannot fail");

                // Return with 200 OK status instead of preserving the original status
                let (mut parts, body) = index_response.into_parts();
                parts.status = StatusCode::OK;
                // Add cache control header to prevent caching of the fallback
                parts.headers.insert(
                    "cache-control",
                    "no-cache"
                        .parse()
                        .expect("\"no-cache\" is a valid static HeaderValue"),
                );

                Ok(Response::from_parts(parts, Body::new(body)))
            } else {
                Ok(response.map(Body::new))
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::collect_body_str;
    use std::fs;
    use tempfile::tempdir;
    use tower::ServiceExt;

    /// Build a SpaFallback rooted at a tempdir containing an `index.html`.
    /// Returns `(service, TempDir)` — keep the TempDir alive for the test.
    fn make_service_with_index(index_body: &str) -> (SpaFallback, tempfile::TempDir) {
        let dir = tempdir().expect("tempdir");
        fs::write(dir.path().join("index.html"), index_body).expect("write index.html");
        let service = create_spa_fallback(
            dir.path().to_string_lossy().into_owned(),
            "index.html".to_string(),
        );
        (service, dir)
    }

    #[tokio::test]
    async fn spa_fallback_serves_index_html_for_missing_route() {
        let (service, _dir) = make_service_with_index("<p>test</p>");
        let req = Request::builder()
            .uri("/nonexistent")
            .body(Body::empty())
            .expect("valid request");

        let resp = service.oneshot(req).await.expect("Infallible");
        assert_eq!(resp.status(), StatusCode::OK);
        let body = collect_body_str(resp).await;
        assert!(
            body.contains("test"),
            "fallback body should contain index.html content, got: {body}"
        );
    }

    #[tokio::test]
    async fn spa_fallback_serves_static_file_when_it_exists() {
        let (service, dir) = make_service_with_index("<p>index</p>");
        fs::write(dir.path().join("file.css"), "body { color: red; }").expect("write css");

        let req = Request::builder()
            .uri("/file.css")
            .body(Body::empty())
            .expect("valid request");

        let resp = service.oneshot(req).await.expect("Infallible");
        assert_eq!(resp.status(), StatusCode::OK);
        let body = collect_body_str(resp).await;
        assert!(
            body.contains("color: red"),
            "expected to serve the static file contents, got: {body}"
        );
    }

    #[tokio::test]
    async fn spa_fallback_sets_no_cache_header_on_fallback() {
        let (service, _dir) = make_service_with_index("<p>test</p>");
        let req = Request::builder()
            .uri("/missing-route")
            .body(Body::empty())
            .expect("valid request");

        let resp = service.oneshot(req).await.expect("Infallible");
        assert_eq!(resp.status(), StatusCode::OK);
        let cache_control = resp
            .headers()
            .get("cache-control")
            .expect("cache-control header must be set on fallback");
        assert_eq!(cache_control, "no-cache");
    }

    #[tokio::test]
    async fn spa_fallback_returns_with_ok_status_not_404() {
        // Regression guard: the whole point of the SPA fallback is converting
        // 404 → 200 OK so the client can handle routing itself.
        let (service, _dir) = make_service_with_index("<p>spa</p>");
        let req = Request::builder()
            .uri("/definitely/not/a/file")
            .body(Body::empty())
            .expect("valid request");

        let resp = service.oneshot(req).await.expect("Infallible");
        assert_eq!(
            resp.status(),
            StatusCode::OK,
            "fallback must return 200 OK, not {}",
            resp.status()
        );
        assert_ne!(resp.status(), StatusCode::NOT_FOUND);
    }
}
