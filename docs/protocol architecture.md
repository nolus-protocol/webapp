# Nolus Protocol Architecture

This document describes the Nolus money market protocol architecture, providing context for backend and UI development.

---

## Overview

Nolus is a DeFi lending protocol that enables leveraged positions across multiple IBC-connected networks. Users can open "leases" - leveraged positions where they borrow from liquidity pools to amplify their exposure to an asset.

---

## Core Hierarchy

```
Network (e.g., Osmosis, Neutron)
├── Active Protocols
│   ├── Protocol: OSMOSIS-OSMOSIS-USDC_NOBLE
│   │   ├── Currencies (lease assets, lpn, stable, payment)
│   │   └── Contracts (leaser, lpp, oracle, profit, reserve)
│   └── Protocol: OSMOSIS-OSMOSIS-USDC_AXELAR
│       ├── Currencies
│       └── Contracts
└── Deprecated Protocols (for history)
    └── Protocol: OSMOSIS-OSMOSIS-OLD_STABLE
        └── (read-only, no new leases)
```

### Key Relationships

| Entity | Definition | Example |
|--------|-----------|---------|
| **Network** | IBC-connected blockchain | Osmosis, Neutron |
| **DEX** | Decentralized exchange on network | Osmosis DEX, Astroport |
| **Protocol** | Network + DEX + LPN currency | `OSMOSIS-OSMOSIS-USDC_NOBLE` |
| **Currency Group** | Set of currencies with specific role | Lease assets, LPN, Stable |

---

## Protocol Structure

A protocol is identified by the pattern: `{NETWORK}-{DEX}-{LPN_CURRENCY}`

### Protocol Naming Convention

```
OSMOSIS-OSMOSIS-USDC_NOBLE
   │       │        │
   │       │        └── LPN (Liquidity Provider Note) currency
   │       └── DEX used for swaps
   └── Network where protocol operates
```

### Protocol Types

**Long Protocols** (current implementation):
- User borrows stable (USDC) to buy volatile asset (ATOM)
- Profits when asset price increases
- Liquidated when asset price drops below threshold

**Short Protocols** (future):
- User borrows volatile asset to sell for stable
- Profits when asset price decreases
- Different contract configuration

---

## Contract Architecture

Each protocol deploys 5 contracts, all registered in the Admin contract:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ADMIN CONTRACT                                  │
│                    (Platform - Network Agnostic)                        │
│  - Protocol registry                                                    │
│  - Contract instantiation with deterministic addresses                  │
│  - Migration orchestration                                              │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐      ┌───────────────┐
│   PROTOCOL A  │     │   PROTOCOL B  │      │   PROTOCOL C  │
│   (Active)    │     │   (Active)    │      │  (Deprecated) │
└───────┬───────┘     └───────┬───────┘      └───────────────┘
        │                     │
        ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    PROTOCOL CONTRACTS                        │
├─────────────┬─────────────┬─────────────┬─────────────┬─────┤
│   LEASER    │     LPP     │   ORACLE    │   PROFIT    │ RSV │
│             │             │             │             │     │
│ Entry point │  Liquidity  │   Price     │  Interest   │ Ins │
│ for leases  │    Pool     │   Feeds     │  Margin     │ ure │
└──────┬──────┴─────────────┴─────────────┴─────────────┴─────┘
       │
       │ instantiates
       ▼
┌─────────────────────────────────────────────────────────────┐
│                     LEASE CONTRACTS                          │
│  (One per customer position)                                 │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Lease 1 │  │ Lease 2 │  │ Lease 3 │  │ Lease N │  ...   │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Contract Responsibilities

| Contract | Role | Key Functions |
|----------|------|---------------|
| **Admin** | Protocol registry | Register/deregister protocols, instantiate contracts |
| **Leaser** | Lease factory | Open new leases, configure parameters, migrate leases |
| **Lease** | Individual position | Track loan, handle repayments, execute close/liquidation |
| **LPP** | Liquidity pool | Accept deposits, issue loans, collect repayments |
| **Oracle** | Price feeds | Maintain prices, send price alerts |
| **Profit** | Margin collection | Collect interest margin, distribute profits |
| **Reserve** | Insurance | Cover liquidation losses, provide shortfall insurance |

---

## Currency System

Currencies are grouped by their role in the protocol. Each protocol defines its own set of supported currencies.

### Currency Groups

```
┌─────────────────────────────────────────────────────────────┐
│                     PAYMENT GROUP                            │
│              (All currencies accepted for payment)           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │    LPN    │  │  NATIVE   │  │   LEASE   │  │ PAYMENT  │ │
│  │   Group   │  │   (NLS)   │  │   Group   │  │   ONLY   │ │
│  ├───────────┤  ├───────────┤  ├───────────┤  ├──────────┤ │
│  │ USDC_NOBLE│  │    NLS    │  │   ATOM    │  │  (other) │ │
│  │USDC_AXELAR│  │           │  │   OSMO    │  │          │ │
│  │           │  │           │  │   TIA     │  │          │ │
│  │           │  │           │  │   INJ     │  │          │ │
│  │           │  │           │  │  ALL_BTC  │  │          │ │
│  │           │  │           │  │  ALL_SOL  │  │          │ │
│  └───────────┘  └───────────┘  └───────────┘  └──────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Currency Group Definitions

| Group | Purpose | Examples |
|-------|---------|----------|
| **Lease Group** | Assets that can be borrowed (leverage target) | ATOM, OSMO, TIA, INJ, ALL_BTC |
| **LPN Group** | Liquidity Provider Notes (pool receipt token) | USDC_NOBLE, USDC_AXELAR |
| **Native** | Nolus native token | NLS |
| **Stable** | Reference currency for valuations | USDC |
| **Payment Group** | Union of all above - can repay loans | All currencies |
| **Payment-Only** | Can only pay, not be borrowed | Protocol-specific |

### Currency Per Protocol

Each protocol has its own set of supported currencies:

```
Protocol: OSMOSIS-OSMOSIS-USDC_NOBLE
├── LPN: USDC_NOBLE
├── Stable: USDC
└── Lease Assets:
    ├── ATOM (min: 40, max: 6000)
    ├── OSMO (min: 40, max: 1000)
    ├── TIA (min: 40, max: 700)
    ├── ALL_BTC (min: 40, max: 10000)
    └── ... (28 total assets)

Protocol: NEUTRON-ASTROPORT-USDC_NOBLE
├── LPN: USDC_NOBLE
├── Stable: USDC
└── Lease Assets:
    ├── ATOM (min: 40, max: 5000)
    ├── NTRN (min: 40, max: 2400)
    ├── TIA (min: 40, max: 100)
    └── ... (different set/limits)
```

---

## Lease Lifecycle

### States

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          LEASE LIFECYCLE                                  │
└──────────────────────────────────────────────────────────────────────────┘

    ┌─────────┐
    │  START  │
    └────┬────┘
         │ OpenLease { currency, max_ltd }
         ▼
┌─────────────────┐
│    OPENING      │  Customer provides downpayment
│   (buy_asset)   │  LPP provides loan
│                 │  DEX swap: stable → asset
└────────┬────────┘
         │ Swap complete
         ▼
┌─────────────────┐
│     OPENED      │  Position is held
│                 │  Customer can:
│  ┌───────────┐  │   - Repay loan
│  │ Monitoring│  │   - Set SL/TP triggers
│  │  LTV %    │  │   - Close position
│  └───────────┘  │
└────────┬────────┘
         │
    ┌────┴────┬─────────────┬──────────────┐
    │         │             │              │
    ▼         ▼             ▼              ▼
┌───────┐ ┌───────┐   ┌──────────┐   ┌──────────┐
│ CLOSE │ │  S/L  │   │   T/P    │   │LIQUIDATE │
│(user) │ │Trigger│   │ Trigger  │   │ (system) │
└───┬───┘ └───┬───┘   └────┬─────┘   └────┬─────┘
    │         │            │              │
    └─────────┴────────────┴──────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │     CLOSING     │  Sell asset via DEX
          │  (sell_asset)   │  Repay loan to LPP
          └────────┬────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
    ┌─────────┐        ┌───────────┐
    │  PAID   │        │ LIQUIDATED│
    │(success)│        │ (loss)    │
    └─────────┘        └───────────┘
```

### Position Specification

Each lease operates within constraints defined by the protocol:

```rust
PositionSpec {
    liability: Liability {
        initial: 70%,           // Max LTV at opening
        healthy: 65%,           // Green zone (safe)
        first_liq_warn: 70%,    // Yellow zone
        second_liq_warn: 75%,   // Orange zone
        third_liq_warn: 78%,    // Red zone
        max: 80%,               // Liquidation threshold
    },
    min_asset: 100 USDC,        // Minimum position size
    min_transaction: 50 USDC,   // Minimum close/repay amount
}
```

### LTV Zones

```
LTV %
  0% ├─────────────────────────────────────────────┤
     │                                             │
     │              HEALTHY (Green)                │
     │                                             │
 65% ├─────────────────────────────────────────────┤
     │         FIRST WARNING (Yellow)              │
 70% ├─────────────────────────────────────────────┤
     │         SECOND WARNING (Orange)             │
 75% ├─────────────────────────────────────────────┤
     │          THIRD WARNING (Red)                │
 78% ├─────────────────────────────────────────────┤
     │              LIQUIDATION                    │
 80% ├─────────────────────────────────────────────┤
     │           (Position Closed)                 │
100% └─────────────────────────────────────────────┘
```

---

## Loan Mechanics

### Opening a Lease

```
Customer wants to open 5x leverage position on ATOM:

1. Customer has: 100 USDC (downpayment)
2. Wants exposure to: 500 USDC worth of ATOM
3. Borrows: 400 USDC from LPP
4. Buys: ~50 ATOM via DEX (at $10/ATOM)

Result:
  - Position: 50 ATOM (~500 USDC value)
  - Loan: 400 USDC principal
  - LTV: 80% (400/500)
  - Downpayment: 20% (100/500)
```

### Interest Calculation

```
Loan Structure:
  principal_due: 400 USDC
  annual_interest_rate: 15% (LPP base rate + margin)
  interest_paid: last_payment_timestamp

Interest Due = principal * rate * (time_elapsed / 1_year)

After 30 days:
  Interest = 400 * 0.15 * (30/365) = 4.93 USDC
```

### Repayment Distribution

```
Customer repays 50 USDC:

1. Calculate interest due: 4.93 USDC
2. Pay interest first:
   - To LPP: 3.93 USDC (base interest)
   - To Profit: 1.00 USDC (margin)
3. Remaining to principal: 45.07 USDC
4. New principal: 354.93 USDC

RepayShares {
    interest: 4.93 USDC,
    principal: 45.07 USDC,
    excess: 0 USDC
}
```

---

## Protocol Creation & Deprecation

### Creating a New Protocol

```
1. Store contract code (wasm)
   └── Returns code_id

2. Predict contract addresses (deterministic)
   └── Uses salt = protocol_name

3. Instantiate contracts in order:
   ├── LPP (needs oracle address)
   ├── Oracle (needs lpp address)
   ├── Profit
   ├── Reserve
   └── Leaser (needs all above)

4. Register protocol in Admin contract
   └── Maps protocol_name → contract addresses
```

### Deprecating a Protocol

```
1. Stop new lease creation
   └── Leaser rejects OpenLease

2. Wait for all leases to close
   └── Users repay or get liquidated

3. Close LPP deposits
   └── No new deposits accepted

4. Dump reserve funds
   └── Return to treasury

5. Deregister from Admin
   └── Protocol marked as deprecated
```

### Protocol Lifecycle

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│   ACTIVE   │ ──► │  CLOSING   │ ──► │ DEPRECATED │
│            │     │            │     │            │
│ New leases │     │ No new     │     │ Read-only  │
│ accepted   │     │ leases     │     │ history    │
└────────────┘     └────────────┘     └────────────┘
```

---

## Data Structure for Backend/UI

Based on the protocol architecture, here's the recommended data structure:

```typescript
interface Network {
  id: string;                    // "OSMOSIS", "NEUTRON"
  chainId: string;               // "osmosis-1", "neutron-1"
  name: string;                  // "Osmosis", "Neutron"
  
  activeProtocols: Protocol[];
  deprecatedProtocols: Protocol[];
}

interface Protocol {
  id: string;                    // "OSMOSIS-OSMOSIS-USDC_NOBLE"
  network: string;               // "OSMOSIS"
  dex: string;                   // "OSMOSIS"
  lpnCurrency: string;           // "USDC_NOBLE"
  
  status: "active" | "closing" | "deprecated";
  
  contracts: {
    leaser: string;
    lpp: string;
    oracle: string;
    profit: string;
    reserve: string;
  };
  
  currencies: ProtocolCurrencies;
  positionSpec: PositionSpec;
}

interface ProtocolCurrencies {
  lpn: Currency;                 // Pool currency (USDC)
  stable: Currency;              // Reference currency
  lease: LeaseAsset[];           // Borrowable assets
  paymentOnly: Currency[];       // Payment-only currencies
}

interface LeaseAsset {
  currency: Currency;
  downpaymentRange: {
    min: number;                 // Minimum position in USD
    max: number;                 // Maximum position in USD
  };
  enabled: boolean;              // Can open new leases
}

interface Currency {
  ticker: string;                // "ATOM"
  bankDenom: string;             // IBC denom on Nolus
  dexDenom: string;              // IBC denom on DEX network
  decimals: number;
  
  // UI enrichment (from admin config)
  icon?: string;
  color?: string;
  displayName?: string;
}
```

### Frontend configStore (Source of Truth)

The frontend uses `configStore` (`src/common/stores/config/index.ts`) to access protocol configuration. **Do not use hardcoded config** - all protocol data comes from the backend via gated propagation.

**Key Methods:**

```typescript
// Get position type for a protocol ("Long" or "Short")
const positionType = configStore.getPositionType("OSMOSIS-OSMOSIS-USDC_NOBLE");

// Get active protocols for a network filter
const protocols = configStore.getActiveProtocolsForNetwork("OSMOSIS");

// Check if a protocol is active/configured
const gatedProtocol = configStore.getGatedProtocol("OSMOSIS-OSMOSIS-USDC_NOBLE");

// Check if network has no active protocols
const disabled = configStore.isProtocolFilterDisabled("OSMOSIS");

// Get LPN currency for a protocol
const lpn = getLpnByProtocol("OSMOSIS-OSMOSIS-USDC_NOBLE");
```

**Removed Patterns (do not use):**
- `ProtocolsConfig[protocol].rewards` - use `configStore.getGatedProtocol(protocol)` instead
- `ProtocolsConfig[protocol].stable` - use `getLpnByProtocol(protocol)` instead
- `Contracts.protocolsFilter` - use `configStore.getActiveProtocolsForNetwork()` instead
- `PositionTypes.long/short` - use `configStore.getPositionType(protocol)` instead

---

## Query Patterns for ETL

### Get All Protocols

```bash
# Query Admin contract
nolusd q wasm contract-state smart <admin_address> '{"protocols":{}}'

# Response
{
  "protocols": [
    "OSMOSIS-OSMOSIS-USDC_NOBLE",
    "OSMOSIS-OSMOSIS-USDC_AXELAR",
    "NEUTRON-ASTROPORT-USDC_NOBLE"
  ]
}
```

### Get Protocol Details

```bash
# Query specific protocol
nolusd q wasm contract-state smart <admin_address> '{
  "protocol": {
    "protocol": "OSMOSIS-OSMOSIS-USDC_NOBLE"
  }
}'

# Response
{
  "network": "Osmosis",
  "dex": "Osmosis", 
  "contracts": {
    "leaser": "nolus1...",
    "lpp": "nolus1...",
    "oracle": "nolus1...",
    "profit": "nolus1...",
    "reserve": "nolus1..."
  }
}
```

### Get Protocol Currencies

```bash
# Query Oracle for supported currencies
nolusd q wasm contract-state smart <oracle_address> '{"currencies":{}}'

# Query LPP for pool currency
nolusd q wasm contract-state smart <lpp_address> '{"config":{}}'
```

### Get User Leases

```bash
# Query Leaser for user's leases
nolusd q wasm contract-state smart <leaser_address> '{
  "leases": {
    "owner": "nolus1user..."
  }
}'

# Response: list of lease contract addresses
```

---

## Key Contract References

| Contract | Source Location |
|----------|-----------------|
| Admin | `/platform/contracts/admin/src/` |
| Leaser | `/protocol/contracts/leaser/src/` |
| Lease | `/protocol/contracts/lease/src/` |
| LPP | `/protocol/contracts/lpp/src/` |
| Oracle | `/protocol/contracts/oracle/src/` |
| Currencies | `/protocol/packages/currencies/src/` |

---

## Summary

The Nolus protocol architecture enables:

1. **Multi-network support** - Protocols operate on different IBC networks (Osmosis, Neutron)
2. **Protocol isolation** - Each protocol has its own contracts and currency set
3. **Flexible currency support** - Currencies grouped by role (lease, lpn, payment)
4. **Safe leverage** - LTV monitoring with liquidation protection
5. **Graceful deprecation** - Protocols can be closed without losing user funds
6. **Deterministic deployment** - Contract addresses predictable before deployment

For backend and UI development:
- **Group data by Network → Protocol → Currencies**
- **Track protocol status** (active/closing/deprecated)
- **Support historical protocols** for lease history display
- **Currency enrichment** via admin config (icons, colors, display names)
