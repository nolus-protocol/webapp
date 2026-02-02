//! Common response type aliases and helpers
//!
//! Reduces verbose type definitions with simple aliases for common patterns.

#![allow(dead_code)]

use axum::Json;
use serde::Serialize;

use crate::error::AppError;

// ============================================================================
// Result Type Aliases
// ============================================================================

/// Standard JSON response result type
pub type JsonResult<T> = Result<Json<T>, AppError>;

/// Response containing a single item
pub type SingleItemResult<T> = JsonResult<T>;

/// Response containing a list of items
pub type ListResult<T> = JsonResult<Vec<T>>;

// ============================================================================
// Common Response Wrappers
// ============================================================================

/// Wrapper for list responses with total count
#[derive(Debug, Serialize)]
pub struct ListResponse<T: Serialize> {
    pub data: Vec<T>,
    pub total: usize,
}

impl<T: Serialize> ListResponse<T> {
    pub fn new(data: Vec<T>) -> Self {
        let total = data.len();
        Self { data, total }
    }

    pub fn with_total(data: Vec<T>, total: usize) -> Self {
        Self { data, total }
    }
}

/// Wrapper for paginated responses
#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub data: Vec<T>,
    pub total: usize,
    pub skip: u32,
    pub limit: u32,
    pub has_more: bool,
}

impl<T: Serialize> PaginatedResponse<T> {
    pub fn new(data: Vec<T>, total: usize, skip: u32, limit: u32) -> Self {
        let has_more = (skip as usize + data.len()) < total;
        Self {
            data,
            total,
            skip,
            limit,
            has_more,
        }
    }
}

/// Simple success response
#[derive(Debug, Serialize)]
pub struct SuccessResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self {
            success: true,
            message: None,
        }
    }

    pub fn with_message(message: impl Into<String>) -> Self {
        Self {
            success: true,
            message: Some(message.into()),
        }
    }
}

/// Response with a single ID
#[derive(Debug, Serialize)]
pub struct IdResponse {
    pub id: String,
}

impl IdResponse {
    pub fn new(id: impl Into<String>) -> Self {
        Self { id: id.into() }
    }
}

/// Response containing transaction messages
#[derive(Debug, Serialize)]
pub struct TransactionResponse {
    pub messages: Vec<serde_json::Value>,
    pub memo: String,
}

impl TransactionResponse {
    pub fn new(messages: Vec<serde_json::Value>, memo: impl Into<String>) -> Self {
        Self {
            messages,
            memo: memo.into(),
        }
    }

    pub fn single(message: serde_json::Value, memo: impl Into<String>) -> Self {
        Self {
            messages: vec![message],
            memo: memo.into(),
        }
    }
}

// ============================================================================
// Amount/Value Response Types
// ============================================================================

/// Simple amount with optional USD value
#[derive(Debug, Clone, Serialize)]
pub struct AmountResponse {
    pub amount: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount_usd: Option<String>,
}

impl AmountResponse {
    pub fn new(amount: impl Into<String>) -> Self {
        Self {
            amount: amount.into(),
            amount_usd: None,
        }
    }

    pub fn with_usd(amount: impl Into<String>, amount_usd: impl Into<String>) -> Self {
        Self {
            amount: amount.into(),
            amount_usd: Some(amount_usd.into()),
        }
    }
}

/// Amount with ticker/symbol
#[derive(Debug, Clone, Serialize)]
pub struct TokenAmount {
    pub ticker: String,
    pub amount: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount_usd: Option<String>,
}

impl TokenAmount {
    pub fn new(ticker: impl Into<String>, amount: impl Into<String>) -> Self {
        Self {
            ticker: ticker.into(),
            amount: amount.into(),
            amount_usd: None,
        }
    }

    pub fn with_usd(
        ticker: impl Into<String>,
        amount: impl Into<String>,
        amount_usd: impl Into<String>,
    ) -> Self {
        Self {
            ticker: ticker.into(),
            amount: amount.into(),
            amount_usd: Some(amount_usd.into()),
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Convert a result to JSON response
pub fn to_json<T: Serialize>(value: T) -> JsonResult<T> {
    Ok(Json(value))
}

/// Convert a list to a list response
pub fn to_list_response<T: Serialize>(items: Vec<T>) -> JsonResult<ListResponse<T>> {
    Ok(Json(ListResponse::new(items)))
}

/// Convert a list with known total to paginated response
pub fn to_paginated_response<T: Serialize>(
    items: Vec<T>,
    total: usize,
    skip: u32,
    limit: u32,
) -> JsonResult<PaginatedResponse<T>> {
    Ok(Json(PaginatedResponse::new(items, total, skip, limit)))
}

