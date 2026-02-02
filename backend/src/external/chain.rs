//! Chain client for direct blockchain queries
//!
//! Queries Oracle and LPP contracts for currency and price data.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::{debug, error};

use crate::error::AppError;

/// Client for querying Cosmos chains via RPC/REST
#[derive(Clone)]
pub struct ChainClient {
    rest_url: String,
    client: Client,
}

/// Currency info from Oracle contract
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleCurrency {
    pub ticker: String,
    pub bank_symbol: String,
    pub decimal_digits: u8,
    pub group: String,
}

/// Price data from Oracle contract
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OraclePrice {
    pub amount: AmountInfo,
    pub amount_quote: AmountInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AmountInfo {
    pub ticker: String,
    pub amount: String,
}

/// Base currency price from Oracle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaseCurrencyPrice {
    pub amount: AmountInfo,
    pub amount_quote: AmountInfo,
}

/// Prices response from Oracle contract
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OraclePricesResponse {
    pub prices: Vec<OraclePrice>,
}

/// Protocol contracts configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolContracts {
    pub protocol: String,
    pub oracle: String,
    pub lpp: String,
    pub leaser: String,
    pub profit: String,
}

impl ChainClient {
    pub fn new(rest_url: String, client: Client) -> Self {
        Self { rest_url, client }
    }

    /// Get a reference to the HTTP client for health checks
    pub fn http_client(&self) -> &Client {
        &self.client
    }

    /// Query a CosmWasm contract
    async fn query_contract<T: for<'de> Deserialize<'de>>(
        &self,
        contract_address: &str,
        query_msg: serde_json::Value,
    ) -> Result<T, AppError> {
        let query_b64 = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            serde_json::to_vec(&query_msg).map_err(|e| AppError::Internal(e.to_string()))?,
        );

        let url = format!(
            "{}/cosmwasm/wasm/v1/contract/{}/smart/{}",
            self.rest_url, contract_address, query_b64
        );

        debug!("Querying contract: {}", url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Query failed: {}", e),
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            error!("Contract query failed: {} - {}", status, body);
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}: {}", status, body),
            });
        }

        #[derive(Deserialize)]
        struct QueryResponse<T> {
            data: T,
        }

        let result: QueryResponse<T> = response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse response: {}", e),
        })?;

        Ok(result.data)
    }

    /// Get all currencies from Oracle contract
    pub async fn get_oracle_currencies(
        &self,
        oracle_address: &str,
    ) -> Result<Vec<OracleCurrency>, AppError> {
        let query = json!({ "currencies": {} });
        self.query_contract(oracle_address, query).await
    }

    /// Get all prices from Oracle contract
    pub async fn get_oracle_prices(
        &self,
        oracle_address: &str,
    ) -> Result<OraclePricesResponse, AppError> {
        let query = json!({ "prices": {} });
        self.query_contract(oracle_address, query).await
    }

    /// Get base currency from Oracle contract
    pub async fn get_base_currency(&self, oracle_address: &str) -> Result<String, AppError> {
        let query = json!({ "base_currency": {} });
        self.query_contract(oracle_address, query).await
    }

    /// Get stable price from Oracle contract
    pub async fn get_stable_price(
        &self,
        oracle_address: &str,
        currency: &str,
    ) -> Result<BaseCurrencyPrice, AppError> {
        let query = json!({ "stable_price": { "currency": currency } });
        self.query_contract(oracle_address, query).await
    }

    /// Get LPN (Liquidity Provider Note) ticker from LPP contract
    pub async fn get_lpn(&self, lpp_address: &str) -> Result<String, AppError> {
        // LPP contract expects empty array for parameterless queries
        let query = json!({ "lpn": [] });
        self.query_contract(lpp_address, query).await
    }

    /// Get deposit capacity from LPP contract
    /// Returns None if there's no capacity limit
    pub async fn get_deposit_capacity(
        &self,
        lpp_address: &str,
    ) -> Result<Option<DepositCapacity>, AppError> {
        // LPP contract expects empty array for parameterless queries
        let query = json!({ "deposit_capacity": [] });
        // The contract may return null if there's no capacity limit
        self.query_contract(lpp_address, query).await
    }

    /// Get total pool value from LPP contract
    pub async fn get_lpp_balance(&self, lpp_address: &str) -> Result<LppBalance, AppError> {
        // LPP contract expects empty array for parameterless queries
        let query = json!({ "lpp_balance": [] });
        self.query_contract(lpp_address, query).await
    }

    /// Query bank balance for an address
    pub async fn get_balance(&self, address: &str, denom: &str) -> Result<BankBalance, AppError> {
        let url = format!(
            "{}/cosmos/bank/v1beta1/balances/{}/by_denom?denom={}",
            self.rest_url, address, denom
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Balance query failed: {}", e),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        #[derive(Deserialize)]
        struct BalanceResponse {
            balance: BankBalance,
        }

        let result: BalanceResponse = response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse balance: {}", e),
        })?;

        Ok(result.balance)
    }

    /// Query all bank balances for an address
    pub async fn get_all_balances(&self, address: &str) -> Result<Vec<BankBalance>, AppError> {
        let url = format!("{}/cosmos/bank/v1beta1/balances/{}", self.rest_url, address);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Balance query failed: {}", e),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        #[derive(Deserialize)]
        struct BalancesResponse {
            balances: Vec<BankBalance>,
        }

        let result: BalancesResponse = response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse balances: {}", e),
        })?;

        Ok(result.balances)
    }

    /// Query lease state from lease contract
    pub async fn get_lease_state(&self, lease_address: &str) -> Result<LeaseState, AppError> {
        let query = json!({ "state": {} });
        self.query_contract(lease_address, query).await
    }

    /// Get validators
    pub async fn get_validators(&self) -> Result<Vec<ValidatorInfo>, AppError> {
        let url = format!(
            "{}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=200",
            self.rest_url
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Validators query failed: {}", e),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        #[derive(Deserialize)]
        struct ValidatorsResponse {
            validators: Vec<ValidatorInfo>,
        }

        let result: ValidatorsResponse = response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse validators: {}", e),
        })?;

        Ok(result.validators)
    }

    /// Get delegations for an address
    pub async fn get_delegations(&self, delegator: &str) -> Result<Vec<DelegationInfo>, AppError> {
        let url = format!(
            "{}/cosmos/staking/v1beta1/delegations/{}",
            self.rest_url, delegator
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Delegations query failed: {}", e),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        #[derive(Deserialize)]
        struct DelegationsResponse {
            delegation_responses: Vec<DelegationInfo>,
        }

        let result: DelegationsResponse =
            response.json().await.map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Failed to parse delegations: {}", e),
            })?;

        Ok(result.delegation_responses)
    }

    /// Get rewards for a delegator
    pub async fn get_rewards(&self, delegator: &str) -> Result<RewardsResponse, AppError> {
        let url = format!(
            "{}/cosmos/distribution/v1beta1/delegators/{}/rewards",
            self.rest_url, delegator
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Rewards query failed: {}", e),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse rewards: {}", e),
        })
    }

    /// Get all protocol names from Admin contract
    pub async fn get_admin_protocols(&self, admin_address: &str) -> Result<Vec<String>, AppError> {
        let query = json!({ "protocols": {} });
        self.query_contract(admin_address, query).await
    }

    /// Get protocol contracts from Admin contract
    pub async fn get_admin_protocol(
        &self,
        admin_address: &str,
        protocol: &str,
    ) -> Result<AdminProtocolResponse, AppError> {
        // The Admin contract expects just the protocol name as string, not nested object
        let query = json!({ "protocol": protocol });
        self.query_contract(admin_address, query).await
    }

    // ========================================================================
    // Leaser Contract Queries
    // ========================================================================

    /// Get all open leases for an owner from Leaser contract
    pub async fn get_customer_leases(
        &self,
        leaser_address: &str,
        owner: &str,
    ) -> Result<Vec<String>, AppError> {
        let query = json!({ "leases": { "owner": owner } });
        self.query_contract(leaser_address, query).await
    }

    /// Get Leaser configuration
    pub async fn get_leaser_config(&self, leaser_address: &str) -> Result<LeaserConfig, AppError> {
        let query = json!({ "config": {} });
        self.query_contract(leaser_address, query).await
    }

    /// Get lease quote from Leaser contract
    pub async fn get_lease_quote(
        &self,
        leaser_address: &str,
        downpayment: &str,
        downpayment_ticker: &str,
        max_ltd: Option<u32>,
    ) -> Result<LeaseQuoteResponse, AppError> {
        let mut query = json!({
            "quote": {
                "downpayment": {
                    "amount": downpayment,
                    "ticker": downpayment_ticker
                }
            }
        });
        if let Some(ltd) = max_ltd {
            query["quote"]["max_ltd"] = serde_json::Value::Number(ltd.into());
        }
        self.query_contract(leaser_address, query).await
    }

    // ========================================================================
    // Lease Contract Queries
    // ========================================================================

    /// Get lease status from a Lease contract
    pub async fn get_lease_status(
        &self,
        lease_address: &str,
    ) -> Result<LeaseStatusResponse, AppError> {
        // Lease contract expects "state" query with empty object
        let query = json!({ "state": {} });
        self.query_contract(lease_address, query).await
    }

    /// Get lease status with due projection
    pub async fn get_lease_status_with_projection(
        &self,
        lease_address: &str,
        due_projection_secs: u64,
    ) -> Result<LeaseStatusResponse, AppError> {
        // Lease contract expects "state" query with optional due_projection_secs
        let query = json!({ "state": { "due_projection_secs": due_projection_secs } });
        self.query_contract(lease_address, query).await
    }

    // ========================================================================
    // LPP Contract Queries (for Earn)
    // ========================================================================

    /// Get lender deposit amount from LPP contract
    pub async fn get_lender_deposit(
        &self,
        lpp_address: &str,
        lender: &str,
    ) -> Result<LenderDeposit, AppError> {
        // LPP contract uses "balance" query with "address" key
        let query = json!({ "balance": { "address": lender } });
        self.query_contract(lpp_address, query).await
    }

    /// Get LPP price (nLPN to LPN conversion rate)
    pub async fn get_lpp_price(&self, lpp_address: &str) -> Result<LppPrice, AppError> {
        // LPP contract expects empty array for parameterless queries
        let query = json!({ "price": [] });
        self.query_contract(lpp_address, query).await
    }

    /// Get LPP configuration
    pub async fn get_lpp_config(&self, lpp_address: &str) -> Result<LppConfig, AppError> {
        // LPP contract expects empty array for parameterless queries
        let query = json!({ "config": [] });
        self.query_contract(lpp_address, query).await
    }

    /// Get LPP quote for deposit - returns how many nLPN for given LPN amount
    pub async fn get_lpp_deposit_quote(
        &self,
        lpp_address: &str,
        amount: &str,
    ) -> Result<String, AppError> {
        let query = json!({ "quote_deposit": { "amount": amount } });
        self.query_contract(lpp_address, query).await
    }

    // ========================================================================
    // Treasury/Dispatcher Queries
    // ========================================================================

    /// Get dispatcher rewards rate
    pub async fn get_dispatcher_rewards(&self, dispatcher_address: &str) -> Result<u32, AppError> {
        let query = json!({ "calculate_rewards": {} });
        self.query_contract(dispatcher_address, query).await
    }

    // ========================================================================
    // Governance Queries
    // ========================================================================

    /// Get governance proposals
    pub async fn get_proposals(
        &self,
        limit: u32,
        reverse: bool,
    ) -> Result<ProposalsResponse, AppError> {
        let url = format!(
            "{}/cosmos/gov/v1/proposals?pagination.limit={}&pagination.reverse={}&pagination.countTotal=true",
            self.rest_url, limit, reverse
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Proposals query failed: {}", e),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse proposals: {}", e),
        })
    }

    /// Get proposal tally
    pub async fn get_proposal_tally(&self, proposal_id: &str) -> Result<TallyResponse, AppError> {
        let url = format!(
            "{}/cosmos/gov/v1/proposals/{}/tally",
            self.rest_url, proposal_id
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Tally query failed: {}", e),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse tally: {}", e),
        })
    }

    /// Get vote for a proposal by address
    pub async fn get_proposal_vote(
        &self,
        proposal_id: &str,
        voter: &str,
    ) -> Result<Option<VoteResponse>, AppError> {
        let url = format!(
            "{}/cosmos/gov/v1/proposals/{}/votes/{}",
            self.rest_url, proposal_id, voter
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Vote query failed: {}", e),
            })?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        let vote: VoteResponse = response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse vote: {}", e),
        })?;

        Ok(Some(vote))
    }

    /// Get tallying params
    pub async fn get_tallying_params(&self) -> Result<TallyingParamsResponse, AppError> {
        let url = format!("{}/cosmos/gov/v1/params/tallying", self.rest_url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Tallying params query failed: {}", e),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse tallying params: {}", e),
        })
    }

    /// Get staking pool (bonded tokens)
    pub async fn get_staking_pool(&self) -> Result<StakingPoolResponse, AppError> {
        let url = format!("{}/cosmos/staking/v1beta1/pool", self.rest_url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Staking pool query failed: {}", e),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse staking pool: {}", e),
        })
    }

    /// Get annual inflation
    pub async fn get_annual_inflation(&self) -> Result<AnnualInflationResponse, AppError> {
        let url = format!("{}/nolus/mint/v1beta1/annual_inflation", self.rest_url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Annual inflation query failed: {}", e),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse annual inflation: {}", e),
        })
    }

    /// Get account info (for vesting)
    pub async fn get_account(&self, address: &str) -> Result<AccountResponse, AppError> {
        let url = format!("{}/cosmos/auth/v1beta1/accounts/{}", self.rest_url, address);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Account query failed: {}", e),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse account: {}", e),
        })
    }

    /// Get denom metadata
    pub async fn get_denom_metadata(&self, denom: &str) -> Result<Option<DenomMetadata>, AppError> {
        let url = format!(
            "{}/cosmos/bank/v1beta1/denoms_metadata/{}",
            self.rest_url, denom
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Denom metadata query failed: {}", e),
            })?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        #[derive(Deserialize)]
        struct MetadataResponse {
            metadata: DenomMetadata,
        }

        let result: MetadataResponse = response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse denom metadata: {}", e),
        })?;

        Ok(Some(result.metadata))
    }

    /// Get node info (ABCI info - version)
    pub async fn get_node_info(
        &self,
    ) -> Result<crate::handlers::governance::NodeInfoResponse, AppError> {
        // Use the RPC URL for ABCI info
        let rpc_url = self.rest_url.replace("/rest", "").replace("lcd", "rpc");
        let url = format!("{}/abci_info", rpc_url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("ABCI info query failed: {}", e),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        #[derive(Deserialize)]
        struct AbciInfoResponse {
            result: AbciInfoResult,
        }

        #[derive(Deserialize)]
        struct AbciInfoResult {
            response: AbciInfo,
        }

        #[derive(Deserialize)]
        struct AbciInfo {
            version: String,
        }

        let result: AbciInfoResponse = response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse ABCI info: {}", e),
        })?;

        Ok(crate::handlers::governance::NodeInfoResponse {
            version: result.result.response.version,
            network: "nolus".to_string(),
        })
    }

    /// Get network status
    pub async fn get_network_status(
        &self,
    ) -> Result<crate::handlers::governance::NetworkStatusResponse, AppError> {
        // Use the RPC URL for status
        let rpc_url = self.rest_url.replace("/rest", "").replace("lcd", "rpc");
        let url = format!("{}/status", rpc_url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("Status query failed: {}", e),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ChainRpc {
                chain: "nolus".to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        #[derive(Deserialize)]
        struct StatusResponse {
            result: StatusResult,
        }

        #[derive(Deserialize)]
        struct StatusResult {
            node_info: NodeInfo,
            sync_info: SyncInfo,
        }

        #[derive(Deserialize)]
        struct NodeInfo {
            network: String,
        }

        #[derive(Deserialize)]
        struct SyncInfo {
            latest_block_height: String,
            latest_block_time: String,
            catching_up: bool,
        }

        let result: StatusResponse = response.json().await.map_err(|e| AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("Failed to parse status: {}", e),
        })?;

        Ok(crate::handlers::governance::NetworkStatusResponse {
            network: result.result.node_info.network,
            latest_block_height: result.result.sync_info.latest_block_height,
            latest_block_time: result.result.sync_info.latest_block_time,
            catching_up: result.result.sync_info.catching_up,
        })
    }
}

// Additional response types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepositCapacity {
    pub amount: String,
}

/// Coin amount with ticker (used in LPP responses)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinWithTicker {
    pub amount: String,
    pub ticker: String,
}

/// nLPN amount (no ticker, just amount)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NlpnAmount {
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LppBalance {
    pub balance: CoinWithTicker,
    pub total_principal_due: CoinWithTicker,
    pub total_interest_due: CoinWithTicker,
    pub balance_nlpn: NlpnAmount,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankBalance {
    pub denom: String,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseState {
    #[serde(flatten)]
    pub state: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorInfo {
    pub operator_address: String,
    pub consensus_pubkey: Option<serde_json::Value>,
    pub jailed: bool,
    pub status: String,
    pub tokens: String,
    pub delegator_shares: String,
    pub description: ValidatorDescription,
    pub commission: ValidatorCommission,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorDescription {
    pub moniker: String,
    pub identity: Option<String>,
    pub website: Option<String>,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorCommission {
    pub commission_rates: CommissionRates,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommissionRates {
    pub rate: String,
    pub max_rate: String,
    pub max_change_rate: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegationInfo {
    pub delegation: Delegation,
    pub balance: BankBalance,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Delegation {
    pub delegator_address: String,
    pub validator_address: String,
    pub shares: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardsResponse {
    pub rewards: Vec<ValidatorReward>,
    pub total: Vec<BankBalance>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorReward {
    pub validator_address: String,
    pub reward: Vec<BankBalance>,
}

/// Admin contract protocol response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminProtocolResponse {
    pub contracts: ProtocolContractsInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolContractsInfo {
    pub oracle: String,
    pub lpp: String,
    pub leaser: String,
    pub profit: String,
    #[serde(default)]
    pub reserve: Option<String>,
}

// ============================================================================
// Leaser Contract Types
// ============================================================================

/// Response from Leaser.customer_leases query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerLeasesResponse(pub Vec<String>);

/// Leaser configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaserConfig {
    pub lease_interest_rate_margin: u32,
    pub lease_position_spec: LeasePositionSpec,
    pub lease_due_period: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeasePositionSpec {
    pub liability: LiabilitySpec,
    pub min_asset: AmountSpec,
    pub min_transaction: AmountSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiabilitySpec {
    pub initial: u32,
    pub healthy: u32,
    pub first_liq_warn: u32,
    pub second_liq_warn: u32,
    pub third_liq_warn: u32,
    pub max: u32,
    pub recalc_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AmountSpec {
    pub amount: String,
    pub ticker: String,
}

// ============================================================================
// Lease Contract Types
// ============================================================================

/// Full lease status from Lease contract
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LeaseStatusResponse {
    Opening(LeaseOpening),
    Opened(LeaseOpened),
    PaidOff(LeasePaidOff),
    Closing(LeaseClosing),
    Closed(LeaseClosed),
    Liquidated(LeaseLiquidated),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseOpening {
    pub opening: LeaseOpeningInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseOpeningInfo {
    pub currency: String,
    pub downpayment: LeaseAmount,
    pub loan: LeaseAmount,
    pub loan_interest_rate: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseOpened {
    pub opened: OpenedLeaseInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenedLeaseInfo {
    pub amount: LeaseAmount,
    pub loan_interest_rate: u32,
    pub margin_interest_rate: u32,
    pub principal_due: LeaseAmount,
    pub overdue_margin: LeaseAmount,
    pub overdue_interest: LeaseAmount,
    pub due_margin: LeaseAmount,
    pub due_interest: LeaseAmount,
    pub validity: String,
    #[serde(default)]
    pub overdue_collect_in: Option<u64>,
    #[serde(default)]
    pub close_policy: Option<LeaseClosePolicy>,
    #[serde(default)]
    pub in_progress: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseClosePolicy {
    pub stop_loss: Option<u32>,
    pub take_profit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseClosing {
    pub closing: ClosingLeaseInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClosingLeaseInfo {
    pub amount: LeaseAmount,
    pub loan_interest_rate: u32,
    pub margin_interest_rate: u32,
    pub principal_due: LeaseAmount,
    pub overdue_margin: LeaseAmount,
    pub overdue_interest: LeaseAmount,
    pub due_margin: LeaseAmount,
    pub due_interest: LeaseAmount,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeasePaidOff {
    pub paid_off: PaidOffInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaidOffInfo {
    pub amount: LeaseAmount,
    pub in_progress: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseClosed {
    pub closed: ClosedInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClosedInfo {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseLiquidated {
    pub liquidated: LiquidatedInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiquidatedInfo {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseAmount {
    pub ticker: String,
    pub amount: String,
}

/// Lease quote response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseQuoteResponse {
    pub borrow: LeaseAmount,
    pub annual_interest_rate: u32,
    pub annual_interest_rate_margin: u32,
}

// ============================================================================
// LPP Contract Types (for Earn)
// ============================================================================

/// Lender deposit from LPP contract
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LenderDeposit {
    pub amount: String,
}

/// LPP price response (nLPN to LPN conversion rate)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LppPrice {
    pub amount: LppPriceAmount,
    pub amount_quote: LppPriceAmount,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LppPriceAmount {
    pub amount: String,
}

/// LPP config
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LppConfig {
    pub lease_code: u64,
    pub borrow_rate: BorrowRate,
    pub min_utilization: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BorrowRate {
    pub base_interest_rate: u32,
    pub utilization_optimal: u32,
    pub addon_optimal_interest_rate: u32,
}

/// Treasury/Dispatcher rewards
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatcherRewards {
    pub rewards: String,
}

// ============================================================================
// Governance Types
// ============================================================================

/// Proposals response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalsResponse {
    pub proposals: Vec<Proposal>,
    pub pagination: PaginationResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationResponse {
    pub total: String,
    #[serde(default)]
    pub next_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proposal {
    pub id: String,
    pub status: String,
    pub final_tally_result: Option<TallyResult>,
    pub submit_time: Option<String>,
    pub deposit_end_time: Option<String>,
    pub voting_start_time: Option<String>,
    pub voting_end_time: Option<String>,
    pub title: Option<String>,
    pub summary: Option<String>,
    #[serde(default)]
    pub messages: Vec<serde_json::Value>,
    #[serde(default)]
    pub metadata: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tally: Option<TallyResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voted: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TallyResult {
    pub yes_count: String,
    pub abstain_count: String,
    pub no_count: String,
    pub no_with_veto_count: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TallyResponse {
    pub tally: TallyResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteResponse {
    pub vote: Vote,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vote {
    pub proposal_id: String,
    pub voter: String,
    pub options: Vec<VoteOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteOption {
    pub option: String,
    pub weight: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TallyingParamsResponse {
    pub params: TallyingParams,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TallyingParams {
    pub quorum: String,
    pub threshold: String,
    pub veto_threshold: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StakingPoolResponse {
    pub pool: StakingPool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StakingPool {
    pub not_bonded_tokens: String,
    pub bonded_tokens: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnualInflationResponse {
    pub annual_inflation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountResponse {
    pub account: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DenomMetadata {
    pub description: String,
    pub denom_units: Vec<DenomUnit>,
    pub base: String,
    pub display: String,
    pub name: String,
    pub symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DenomUnit {
    pub denom: String,
    pub exponent: u32,
    #[serde(default)]
    pub aliases: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    async fn setup_mock_server() -> MockServer {
        MockServer::start().await
    }

    fn create_test_client(base_url: &str) -> ChainClient {
        ChainClient::new(base_url.to_string(), reqwest::Client::new())
    }

    #[tokio::test]
    async fn test_get_all_balances() {
        let mock_server = setup_mock_server().await;
        let client = create_test_client(&mock_server.uri());

        let response_body = serde_json::json!({
            "balances": [
                {"denom": "unls", "amount": "1000000"},
                {"denom": "ibc/ABC123", "amount": "500000"}
            ]
        });

        Mock::given(method("GET"))
            .and(path("/cosmos/bank/v1beta1/balances/nolus1testaddr"))
            .respond_with(ResponseTemplate::new(200).set_body_json(&response_body))
            .mount(&mock_server)
            .await;

        let result = client.get_all_balances("nolus1testaddr").await;
        assert!(result.is_ok());

        let balances = result.unwrap();
        assert_eq!(balances.len(), 2);
        assert_eq!(balances[0].denom, "unls");
        assert_eq!(balances[0].amount, "1000000");
    }

    #[tokio::test]
    async fn test_get_validators() {
        let mock_server = setup_mock_server().await;
        let client = create_test_client(&mock_server.uri());

        let response_body = serde_json::json!({
            "validators": [
                {
                    "operator_address": "nolusvaloper1abc",
                    "consensus_pubkey": null,
                    "jailed": false,
                    "status": "BOND_STATUS_BONDED",
                    "tokens": "1000000000",
                    "delegator_shares": "1000000000.000000000000000000",
                    "description": {
                        "moniker": "Test Validator",
                        "identity": "ABCD1234",
                        "website": "https://test.com",
                        "details": "A test validator"
                    },
                    "commission": {
                        "commission_rates": {
                            "rate": "0.100000000000000000",
                            "max_rate": "0.200000000000000000",
                            "max_change_rate": "0.010000000000000000"
                        }
                    }
                }
            ]
        });

        Mock::given(method("GET"))
            .and(path("/cosmos/staking/v1beta1/validators"))
            .respond_with(ResponseTemplate::new(200).set_body_json(&response_body))
            .mount(&mock_server)
            .await;

        let result = client.get_validators().await;
        assert!(result.is_ok());

        let validators = result.unwrap();
        assert_eq!(validators.len(), 1);
        assert_eq!(validators[0].operator_address, "nolusvaloper1abc");
        assert_eq!(validators[0].description.moniker, "Test Validator");
    }

    #[tokio::test]
    async fn test_get_delegations() {
        let mock_server = setup_mock_server().await;
        let client = create_test_client(&mock_server.uri());

        let response_body = serde_json::json!({
            "delegation_responses": [
                {
                    "delegation": {
                        "delegator_address": "nolus1testaddr",
                        "validator_address": "nolusvaloper1abc",
                        "shares": "1000000.000000000000000000"
                    },
                    "balance": {
                        "denom": "unls",
                        "amount": "1000000"
                    }
                }
            ]
        });

        Mock::given(method("GET"))
            .and(path("/cosmos/staking/v1beta1/delegations/nolus1testaddr"))
            .respond_with(ResponseTemplate::new(200).set_body_json(&response_body))
            .mount(&mock_server)
            .await;

        let result = client.get_delegations("nolus1testaddr").await;
        assert!(result.is_ok());

        let delegations = result.unwrap();
        assert_eq!(delegations.len(), 1);
        assert_eq!(
            delegations[0].delegation.delegator_address,
            "nolus1testaddr"
        );
        assert_eq!(delegations[0].balance.amount, "1000000");
    }

    #[tokio::test]
    async fn test_balance_query_error_handling() {
        let mock_server = setup_mock_server().await;
        let client = create_test_client(&mock_server.uri());

        Mock::given(method("GET"))
            .and(path("/cosmos/bank/v1beta1/balances/invalid"))
            .respond_with(ResponseTemplate::new(400).set_body_string("Bad Request"))
            .mount(&mock_server)
            .await;

        let result = client.get_all_balances("invalid").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_rewards() {
        let mock_server = setup_mock_server().await;
        let client = create_test_client(&mock_server.uri());

        let response_body = serde_json::json!({
            "rewards": [
                {
                    "validator_address": "nolusvaloper1abc",
                    "reward": [
                        {"denom": "unls", "amount": "1000.500000000000000000"}
                    ]
                }
            ],
            "total": [
                {"denom": "unls", "amount": "1000.500000000000000000"}
            ]
        });

        Mock::given(method("GET"))
            .and(path(
                "/cosmos/distribution/v1beta1/delegators/nolus1testaddr/rewards",
            ))
            .respond_with(ResponseTemplate::new(200).set_body_json(&response_body))
            .mount(&mock_server)
            .await;

        let result = client.get_rewards("nolus1testaddr").await;
        assert!(result.is_ok());

        let rewards = result.unwrap();
        assert_eq!(rewards.rewards.len(), 1);
        assert_eq!(rewards.total.len(), 1);
    }
}
