//! Translation management module
//!
//! Provides AI-powered translation generation, approval workflows,
//! and locale file management for the admin interface.

pub mod audit;
pub mod openai;
pub mod storage;
pub mod types;
pub mod validation;

// Re-exports
pub use storage::TranslationStorage;
pub use types::*;
pub use validation::extract_placeholders;
