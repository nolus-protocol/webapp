-- Gated Propagation System - Initial Schema
-- This schema stores admin-provided enrichment data that gets merged with ETL data

-- Currency enrichment (admin-provided visual metadata)
CREATE TABLE currency_display (
    ticker VARCHAR(50) PRIMARY KEY,
    icon_url TEXT NOT NULL,
    color VARCHAR(7) DEFAULT '#808080',
    display_name VARCHAR(100) NOT NULL,
    coingecko_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Network configuration (admin-provided infrastructure config)
CREATE TABLE network_config (
    network_key VARCHAR(50) PRIMARY KEY,
    explorer_url TEXT NOT NULL,
    gas_price DECIMAL(20, 10) NOT NULL,
    gas_multiplier DECIMAL(5, 2) NOT NULL DEFAULT 1.5,
    primary_protocol VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Network endpoints (RPC/LCD URLs)
CREATE TABLE network_endpoints (
    id SERIAL PRIMARY KEY,
    network_key VARCHAR(50) NOT NULL REFERENCES network_config(network_key) ON DELETE CASCADE,
    endpoint_type VARCHAR(10) NOT NULL CHECK (endpoint_type IN ('rpc', 'lcd')),
    url TEXT NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset restrictions (blacklists, disabled assets)
CREATE TABLE asset_restrictions (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(50) NOT NULL,
    restriction_type VARCHAR(30) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ticker, restriction_type)
);
-- restriction_type values: 'ignored', 'disabled_long', 'disabled_short', 'swap_blacklist', 'transfer_blacklist'

-- Lease downpayment ranges (per protocol, per asset)
CREATE TABLE lease_downpayment_ranges (
    id SERIAL PRIMARY KEY,
    protocol VARCHAR(100) NOT NULL,
    asset_ticker VARCHAR(50) NOT NULL,
    min_amount DECIMAL(20, 2) NOT NULL,
    max_amount DECIMAL(20, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(protocol, asset_ticker)
);

-- Protocol status (configured, blacklisted, unconfigured)
CREATE TABLE protocol_status (
    protocol VARCHAR(100) PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'unconfigured' CHECK (status IN ('configured', 'blacklisted', 'unconfigured')),
    reason TEXT,
    configured_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Swap configuration (key-value store)
CREATE TABLE swap_config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Swap venues (DEX addresses)
CREATE TABLE swap_venues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    chain_id VARCHAR(50) NOT NULL,
    address VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UI settings (key-value with JSONB for complex values)
CREATE TABLE ui_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_network_endpoints_key ON network_endpoints(network_key);
CREATE INDEX idx_network_endpoints_active ON network_endpoints(network_key, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_asset_restrictions_type ON asset_restrictions(restriction_type);
CREATE INDEX idx_asset_restrictions_ticker ON asset_restrictions(ticker);
CREATE INDEX idx_lease_ranges_protocol ON lease_downpayment_ranges(protocol);
CREATE INDEX idx_protocol_status_status ON protocol_status(status);
CREATE INDEX idx_swap_venues_active ON swap_venues(is_active) WHERE is_active = TRUE;
