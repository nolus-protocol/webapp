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
            let response = serve_dir.call(req).await.unwrap();

            // If the file was not found (404), serve index.html with 200 OK
            if response.status() == StatusCode::NOT_FOUND {
                // Create a new request for index.html
                let index_req = Request::builder()
                    .uri(Uri::from_static("/index.html"))
                    .body(Body::empty())
                    .unwrap();

                // Create a new ServeDir to serve index.html
                let mut index_serve = ServeDir::new(&static_dir);
                let index_response = index_serve.call(index_req).await.unwrap();

                // Return with 200 OK status instead of preserving the original status
                let (mut parts, body) = index_response.into_parts();
                parts.status = StatusCode::OK;
                // Add cache control header to prevent caching of the fallback
                parts
                    .headers
                    .insert("cache-control", "no-cache".parse().unwrap());

                Ok(Response::from_parts(parts, Body::new(body)))
            } else {
                Ok(response.map(Body::new))
            }
        })
    }
}
