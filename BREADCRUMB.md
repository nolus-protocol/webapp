# Session Breadcrumb - 2026-02-02

## Where We Left Off

We were analyzing the **config system relationships** to understand how network configs, endpoints, skip transfers, currencies, and protocols interconnect.

## Key Discovery: Config Interdependencies

All configs are linked via **network keys** extracted from ETL protocol names:

```
ETL Protocol: "OSMOSIS-OSMOSIS-USDC_NOBLE"
                  ↓
        Network Key: "OSMOSIS"
                  ↓
    Must exist in:
    - networks.json["OSMOSIS"]
    - endpoints/pirin.json["OSMOSIS"]
    - skip-route transfers["OSMOSIS"]
```

## Current Risk: No Validation

The system has **no explicit validation** that configs are consistent:
- If network key not found in endpoints → returns empty strings (silent failure)
- No startup check that all ETL networks have matching config entries
- Mismatched keys cause transactions to fail without clear errors

## Key Insight: Gated Propagation System

ETL data should NOT automatically flow to frontend. It must pass through admin validation:

```
ETL (source of truth)
    ↓
Backend validates against local config
    ↓
┌─────────────────────────────────────────────────┐
│ If protocol/currency NOT configured:            │
│   → Hold in "pending" state                     │
│   → Show to admin for configuration             │
│   → NOT propagated to frontend                  │
├─────────────────────────────────────────────────┤
│ If protocol/currency IS configured:             │
│   → Check blacklist status                      │
│   → Check active/inactive status                │
│   → Propagate to frontend (if allowed)          │
└─────────────────────────────────────────────────┘
```

### Three Admin Controls Needed

1. **Configuration Gate**
   - New protocols from ETL need: network config, endpoints, currency metadata
   - Until configured → held in "pending", not shown to users
   - Admin dashboard shows "Unconfigured Protocols/Currencies"

2. **Blacklist Control**
   - Admin can blacklist specific protocols or currencies
   - Blacklisted items exist in ETL but are hidden from frontend
   - Useful for: problematic assets, regulatory issues, temporary issues

3. **Active/Inactive Handling**
   - ETL provides `is_active` flag for protocols/currencies
   - Inactive items: still queryable (for historical leases) but not for new operations
   - Frontend needs to distinguish: "can open new lease" vs "can view existing lease"

### Data Flow Design

```
GET /api/protocols (frontend)
    ↓
Backend:
    1. Fetch all from ETL
    2. Filter out: unconfigured (no endpoints/network config)
    3. Filter out: blacklisted
    4. Mark: active vs inactive
    5. Return to frontend

GET /api/admin/protocols (admin)
    ↓
Backend:
    1. Fetch all from ETL
    2. Categorize: configured | unconfigured | blacklisted
    3. Show all with status flags
    4. Admin can: configure, blacklist, unblacklist
```

### Config Structure Needed

```json
// backend/config/admin/protocol-status.json
{
  "blacklisted": ["PROTOCOL-X-USDC"],
  "configured": {
    "OSMOSIS-OSMOSIS-USDC_NOBLE": {
      "network": "OSMOSIS",
      "configured_at": "2024-01-15T00:00:00Z"
    }
  }
}

// backend/config/admin/currency-status.json  
{
  "blacklisted": ["SCAM_TOKEN"],
  "overrides": {
    "USDC_NOBLE": {
      "display_name": "USDC",
      "icon_override": "/custom/usdc.svg"
    }
  }
}
```

## Suggested Next Steps

1. **Design admin status configs** - `protocol-status.json`, `currency-status.json`
2. **Add validation layer** - Filter ETL data through config gate before serving to frontend
3. **Add admin endpoints** - List unconfigured, blacklist/unblacklist, configure
4. **Handle inactive correctly** - Separate "new operations" from "view existing"

## Files Modified This Session

- `backend/src/external/etl.rs` - Fixed `EtlTvlResponse` type
- `backend/src/handlers/earn.rs` - Use ETL for TVL
- `backend/.env` - Added Referral, Zero Interest, Admin API credentials
- `backend/config/zero-interest/payment-addresses.json` - Created (was missing)
- `CLAUDE.md` - Added Design Principles and Code Quality Rules

## External Services Tested

| Service | Endpoint | Status |
|---------|----------|--------|
| Zero Interest API | `http://192.168.4.74:3631` | Working |
| Referral API | `http://10.133.133.132:3244` | Working |
| Admin API | Local with bearer token | Working |

## Commits Made

- `refactor: migrate to ETL as primary data source for protocols, currencies, and TVL`

## Open Questions

- Should we add strict validation at startup or lazy validation on first request?
- How to handle deprecated protocols that exist in ETL but not in local configs?
- Should the frontend receive validation errors or should backend auto-fix?
