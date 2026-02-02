//! Configuration Store Module
//!
//! This module provides file-based configuration storage for the webapp.
//! All configuration that was previously fetched from GitHub is now
//! served through this store with admin endpoints for on-the-fly editing.
//!
//! ## Features
//! - JSON file-based storage with atomic writes
//! - In-memory caching with configurable TTL
//! - Validation before saving
//! - Admin API for CRUD operations
//!
//! ## Config Types
//! - Currencies (metadata, icons, mappings)
//! - Chain IDs (cosmos, evm)
//! - Network Endpoints (RPC/LCD per network)
//! - Lease Settings (downpayment ranges, ignore lists)
//! - Zero Interest (payment addresses)
//! - Skip Route Config (swap settings)
//! - Governance (hidden proposals)
//! - Locales (i18n translations)

pub mod storage;
pub mod types;

pub use storage::ConfigStore;
