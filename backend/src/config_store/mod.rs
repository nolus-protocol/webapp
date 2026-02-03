//! Configuration Store Module
//!
//! This module provides file-based configuration storage for the webapp.
//! Configuration is stored in JSON files under `backend/config/gated/`.
//!
//! ## Features
//! - JSON file-based storage with atomic writes
//! - In-memory caching with configurable TTL
//! - Validation before saving
//! - Admin API for CRUD operations
//!
//! ## Gated Propagation Config Types
//! - Currency Display (enrichment: icon, displayName, color)
//! - Network Config (endpoints, gas, primaryProtocol)
//! - Lease Rules (downpayment ranges, asset restrictions)
//! - Swap Settings (Skip API config, blacklist, venues)
//! - UI Settings (hidden proposals, feature flags, maintenance)
//!
//! ## Locales
//! - Translation files (i18n) in `backend/config/locales/`

pub mod gated_types;
pub mod storage;

pub use storage::ConfigStore;
