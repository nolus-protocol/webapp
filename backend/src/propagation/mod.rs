//! Gated Propagation Module
//!
//! This module handles the gated propagation system where ETL items are
//! hidden by default until explicitly configured by admin.
//!
//! ## Components
//! - `validator`: Validates config against ETL data
//! - `filter`: Filters unconfigured/blacklisted items
//! - `merger`: Merges ETL data with enrichment config
//!
//! ## Design Principles
//! - **Hidden by default**: Unconfigured items never reach frontend
//! - **No fallbacks**: Fail fast if config is invalid or missing
//! - **Protocol status is derived**: Based on network + currency configuration

pub mod filter;
pub mod merger;
pub mod validator;

pub use filter::PropagationFilter;
pub use merger::PropagationMerger;
pub use validator::PropagationValidator;
