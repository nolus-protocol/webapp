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

## Suggested Next Steps

1. **Add startup validation** - Check all ETL networks have entries in `networks.json` and `endpoints/*.json`
2. **Add admin endpoint** - `/api/admin/config/validate` to check consistency
3. **Fail loudly** - Return errors instead of empty strings when network not found

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
