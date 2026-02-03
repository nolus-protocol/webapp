//! Propagation module for gated data flow.
//!
//! This module controls what data flows from ETL to the frontend.
//! Unconfigured or blacklisted items are filtered out by default.

pub mod filter;
pub mod merger;
pub mod validator;

// Re-export commonly used items
pub use filter::PropagationFilter;
pub use merger::DataMerger;
pub use validator::PropagationValidator;
