//! OpenAPI specification aggregator
//!
//! Exposes the backend's public REST surface as an OpenAPI 3.1 document at
//! `GET /api/openapi.json`. The spec covers unauthenticated read and write
//! routes; admin endpoints gated by `admin_auth_middleware` are intentionally
//! omitted to avoid advertising the admin surface publicly.
//!
//! When handlers change their request/response shape, the `openapi.snapshot.json`
//! diff test (below) will fail. Regenerate it intentionally with:
//!
//!     UPDATE_OPENAPI_SNAPSHOT=1 cargo test openapi

use std::sync::LazyLock;

use axum::Json;
use utoipa::OpenApi;

use crate::error::{ErrorBody, ErrorResponse};
use crate::external;
use crate::handlers::{
    admin, common_types, config, currencies, earn, etl_proxy, fees, gated_assets, gated_networks,
    gated_protocols, governance, leases, locales, protocols, referral, staking, swap, transactions,
    zero_interest,
};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Nolus Protocol Webapp API",
        description = "Public REST API backing app.nolus.io. Read endpoints are cached and free to call; write endpoints return unsigned transaction payloads for client-side signing. Admin endpoints require API key auth and are intentionally omitted from this spec.",
        version = "1.0.0",
        contact(name = "Nolus Protocol", url = "https://nolus.io/"),
        license(name = "Apache-2.0"),
    ),
    servers(
        (url = "https://app.nolus.io", description = "Production"),
        (url = "https://app-dev.nolus.io", description = "Staging"),
    ),
    paths(
        // Health
        admin::health_check,
        admin::detailed_health_check,
        // Intercom
        admin::intercom_hash,
        // Config
        config::get_config,
        config::get_protocols,
        config::get_networks,
        // Currencies / prices / balances
        currencies::get_currencies,
        currencies::get_currency,
        currencies::get_prices,
        currencies::get_balances,
        // Protocols
        protocols::get_protocols,
        protocols::get_active_protocols,
        // Locales
        locales::get_locale,
        // Fees
        fees::get_gas_fee_config,
        // Leases
        leases::get_leases,
        leases::get_lease,
        leases::get_lease_history,
        leases::get_lease_config,
        leases::get_lease_quote,
        leases::open_lease,
        leases::repay_lease,
        leases::close_lease,
        leases::market_close_lease,
        // Earn
        earn::get_pools,
        earn::get_pool,
        earn::get_positions,
        earn::get_earn_stats,
        earn::deposit,
        earn::withdraw,
        // Staking
        staking::get_validators,
        staking::get_validator,
        staking::get_positions,
        staking::get_staking_params,
        staking::delegate,
        staking::undelegate,
        staking::redelegate,
        staking::claim_rewards,
        // Governance
        governance::get_hidden_proposals,
        governance::get_proposals,
        governance::get_proposal_tally,
        governance::get_proposal_vote,
        governance::get_tallying_params,
        governance::get_staking_pool,
        governance::get_apr,
        governance::get_account,
        governance::get_denom_metadata,
        governance::get_node_info,
        governance::get_network_status,
        // Referral
        referral::validate_code,
        referral::register,
        referral::get_stats,
        referral::get_rewards,
        referral::get_payouts,
        referral::get_referrals,
        referral::assign,
        // Zero-interest / campaigns
        zero_interest::get_config,
        zero_interest::check_eligibility,
        zero_interest::get_payments,
        zero_interest::get_lease_payments,
        zero_interest::create_payment,
        zero_interest::cancel_payment,
        zero_interest::get_active_campaigns,
        zero_interest::check_campaign_eligibility,
        // Gated — assets / protocols / networks (public read views)
        gated_assets::get_assets,
        gated_assets::get_asset,
        gated_assets::get_network_assets,
        gated_protocols::get_protocols,
        gated_protocols::get_protocol_currencies,
        gated_protocols::get_network_protocols,
        gated_networks::get_networks,
        gated_networks::get_network,
        gated_networks::get_network_pools,
        // Swap (opaque passthrough — bodies not typed)
        swap::get_swap_config,
        swap::get_status,
        swap::get_chains,
        swap::track_transaction,
        swap::get_route,
        swap::get_messages,
        // ETL proxy (opaque passthrough)
        etl_proxy::proxy_subscribe,
        etl_proxy::batch_stats_overview,
        etl_proxy::batch_loans_stats,
        etl_proxy::batch_user_dashboard,
        etl_proxy::batch_user_history,
        etl_proxy::etl_proxy_generic,
        // Enriched transactions (opaque passthrough)
        transactions::get_enriched_transactions,
    ),
    components(schemas(
        // Error
        ErrorResponse,
        ErrorBody,
        // Common
        common_types::ProtocolContracts,
        common_types::CurrencyDisplayInfo,
        // Config
        config::AppConfigResponse,
        config::ProtocolInfo,
        config::NetworkInfo,
        config::NativeAssetInfo,
        config::ContractsInfo,
        // Currencies
        currencies::CurrencyInfo,
        currencies::CurrenciesResponse,
        currencies::PricesResponse,
        currencies::PriceInfo,
        currencies::BalancesResponse,
        currencies::BalanceInfo,
        // Protocols
        protocols::Protocol,
        protocols::ProtocolsResponse,
        // Fees
        fees::GasFeeConfigResponse,
        // Leases
        leases::LeasesResponse,
        leases::LeaseInfo,
        leases::LeaseStatusType,
        leases::LeaseAssetInfo,
        leases::LeaseDebtInfo,
        leases::LeaseInterestInfo,
        leases::LeasePnlInfo,
        leases::LeaseClosePolicy,
        leases::LeaseInProgress,
        leases::LeaseOpeningStateInfo,
        leases::LeaseEtlData,
        leases::LeaseHistoryEntry,
        leases::LeaseQuoteRequest,
        leases::LeaseQuoteResponse,
        leases::OpenLeaseRequest,
        leases::LeaseTransactionResponse,
        leases::RepayLeaseRequest,
        leases::CloseLeaseRequest,
        leases::MarketCloseRequest,
        leases::LeaseConfigResponse,
        // Earn
        earn::EarnPool,
        earn::EarnPosition,
        earn::EarnPositionsResponse,
        earn::DepositRequest,
        earn::WithdrawRequest,
        earn::EarnTransactionResponse,
        earn::EarnStats,
        // Staking
        staking::Validator,
        staking::ValidatorStatus,
        staking::StakingPosition,
        staking::BalanceInfo,
        staking::UnbondingPosition,
        staking::UnbondingEntry,
        staking::StakingPositionsResponse,
        staking::ValidatorReward,
        staking::DelegateRequest,
        staking::UndelegateRequest,
        staking::RedelegateRequest,
        staking::ClaimRewardsRequest,
        staking::StakingTransactionResponse,
        staking::StakingParams,
        // Governance
        governance::HiddenProposalsResponse,
        governance::ProposalResponse,
        governance::ProposalsListResponse,
        governance::PaginationInfo,
        governance::AprResponse,
        governance::NodeInfoResponse,
        governance::NetworkStatusResponse,
        external::chain::TallyResult,
        external::chain::TallyResponse,
        external::chain::VoteResponse,
        external::chain::Vote,
        external::chain::VoteOption,
        external::chain::TallyingParamsResponse,
        external::chain::TallyingParams,
        external::chain::StakingPoolResponse,
        external::chain::StakingPool,
        external::chain::AccountResponse,
        external::chain::DenomMetadata,
        external::chain::DenomUnit,
        external::chain::AmountSpec,
        // Referral
        referral::ValidateCodeResponse,
        referral::RegisterRequest,
        referral::RegisterResponse,
        referral::ReferrerResponse,
        referral::StatsResponse,
        referral::ReferrerStatsResponse,
        referral::RewardResponse,
        referral::RewardsListResponse,
        referral::PayoutResponse,
        referral::PayoutsListResponse,
        referral::ReferralResponse,
        referral::ReferralsListResponse,
        referral::AssignRequest,
        referral::AssignResponse,
        external::referral::ReferrerTier,
        external::referral::ReferrerStatus,
        external::referral::ReferralStatus,
        external::referral::RewardStatus,
        external::referral::PayoutStatus,
        // Zero-interest / campaigns
        zero_interest::ZeroInterestConfigResponse,
        zero_interest::EligibilityResponse,
        zero_interest::PaymentResponse,
        zero_interest::PaymentStatus,
        zero_interest::CreatePaymentRequest,
        zero_interest::CreatePaymentResponse,
        zero_interest::CancelPaymentRequest,
        external::zero_interest::ActiveCampaignsResponse,
        external::zero_interest::ZeroInterestCampaign,
        external::zero_interest::CampaignEligibilityResponse,
        external::zero_interest::CampaignMatch,
        // Gated — assets / protocols / networks
        gated_assets::AssetResponse,
        gated_assets::AssetsResponse,
        gated_assets::AssetDetailResponse,
        gated_assets::ProtocolAssetDetail,
        gated_protocols::ProtocolResponse,
        gated_protocols::ProtocolsResponse,
        gated_protocols::ProtocolCurrencyResponse,
        gated_protocols::ProtocolCurrenciesResponse,
        gated_networks::NetworkResponse,
        gated_networks::NetworksResponse,
        gated_networks::PoolResponse,
        gated_networks::NetworkPoolsResponse,
        // Swap typed bodies (responses remain opaque)
        swap::RouteRequest,
        swap::MessagesRequest,
        swap::TrackRequest,
        swap::TrackResponse,
        // ETL batch passthroughs (fields opaque)
        etl_proxy::StatsOverviewBatch,
        etl_proxy::LoansStatsBatch,
        etl_proxy::UserDashboardBatch,
        etl_proxy::UserHistoryBatch,
        // Admin subset — health + intercom only
        admin::HealthResponse,
        admin::DetailedHealthResponse,
        admin::ServiceHealth,
        admin::ServiceStatus,
        admin::CacheHealth,
        admin::IntercomTokenRequest,
        admin::IntercomTokenResponse,
    )),
    tags(
        (name = "health", description = "Liveness and readiness probes"),
        (name = "config", description = "Application configuration (protocols, networks, contracts)"),
        (name = "currencies", description = "Supported currencies catalog"),
        (name = "prices", description = "Oracle price feeds"),
        (name = "balances", description = "Wallet balances"),
        (name = "protocols", description = "Nolus DeFi sub-protocol registry"),
        (name = "locales", description = "Translation blobs for the frontend"),
        (name = "fees", description = "Gas fee configuration"),
        (name = "leases", description = "Leverage lease positions (read + write)"),
        (name = "earn", description = "Liquidity-pool deposits and yields"),
        (name = "staking", description = "NLS staking delegations"),
        (name = "governance", description = "Proposals, tallies, voting parameters"),
        (name = "node", description = "Node info and network status"),
        (name = "referral", description = "Referral codes and rewards"),
        (name = "zero-interest", description = "Zero-interest payments scheduled on leases"),
        (name = "campaigns", description = "Zero-interest campaigns"),
        (name = "assets", description = "Gated assets catalog (deduplicated view)"),
        (name = "networks", description = "Gated networks catalog"),
        (name = "swap", description = "Cross-chain swap (Skip passthrough, opaque bodies)"),
        (name = "etl", description = "ETL proxy endpoints (opaque passthrough)"),
        (name = "transactions", description = "Enriched transactions (opaque passthrough)"),
        (name = "intercom", description = "Intercom user-hash issuance"),
    ),
)]
pub struct ApiDoc;

/// Cached OpenAPI document — built once, reused across requests.
static CACHED_SPEC: LazyLock<utoipa::openapi::OpenApi> = LazyLock::new(ApiDoc::openapi);

/// Serve the OpenAPI document as JSON.
pub async fn serve_openapi() -> Json<utoipa::openapi::OpenApi> {
    Json(CACHED_SPEC.clone())
}

#[cfg(test)]
mod tests {
    //! Snapshot test: the generated OpenAPI document is compared against the
    //! committed `openapi.snapshot.json`. Any unreviewed drift fails the test,
    //! so the spec cannot change without an explicit snapshot update:
    //!
    //!     UPDATE_OPENAPI_SNAPSHOT=1 cargo test openapi
    //!
    //! The snapshot doubles as reviewable payload for `/api/openapi.json`.

    use super::ApiDoc;
    use std::path::PathBuf;
    use utoipa::OpenApi;

    fn snapshot_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("openapi.snapshot.json")
    }

    fn render_current_spec() -> String {
        let spec = ApiDoc::openapi();
        let mut out = serde_json::to_string_pretty(&spec).expect("spec serializes");
        out.push('\n');
        out
    }

    #[test]
    fn openapi_spec_matches_snapshot() {
        let current = render_current_spec();
        let path = snapshot_path();

        if std::env::var("UPDATE_OPENAPI_SNAPSHOT").is_ok() {
            std::fs::write(&path, &current).expect("write snapshot");
            return;
        }

        let expected = std::fs::read_to_string(&path).expect(
            "openapi.snapshot.json must exist — run with UPDATE_OPENAPI_SNAPSHOT=1 to create it",
        );

        if expected != current {
            panic!(
                "OpenAPI spec drifted from committed snapshot at {}.\n\n\
                 If the change is intentional, regenerate the snapshot:\n\n    \
                 UPDATE_OPENAPI_SNAPSHOT=1 cargo test openapi\n\n\
                 Then commit the updated file.",
                path.display()
            );
        }
    }

    #[test]
    fn openapi_spec_has_no_admin_routes() {
        let spec = ApiDoc::openapi();
        let paths: Vec<&String> = spec.paths.paths.keys().collect();
        // All admin-gated routes are nested under `/api/admin/...` in main.rs,
        // including `/translations/*`, `/gated/*`, and `/cache/*`. Checking the
        // prefix is sufficient. Note: `/api/networks/gated` and
        // `/api/protocols/gated` are PUBLIC read views over the gated data —
        // they are not admin routes despite the name.
        let admin_paths: Vec<_> = paths
            .iter()
            .filter(|p| p.starts_with("/api/admin"))
            .collect();

        assert!(
            admin_paths.is_empty(),
            "public OpenAPI spec must not include admin routes, found: {:?}",
            admin_paths
        );
    }
}
