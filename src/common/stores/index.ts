/**
 * Pinia Stores - Central export for all stores
 */

// Backend-integrated stores
export { useConnectionStore } from "./connection";
export { useConfigStore } from "./config";
export { usePricesStore } from "./prices";
export { useBalancesStore } from "./balances";
export { useLeasesStore } from "./leases";
export { useStakingStore } from "./staking";
export { useEarnStore } from "./earn";
export { useCampaignsStore } from "./campaigns";
export { useReferralsStore } from "./referrals";

// Application stores
export { useApplicationStore, ApplicationActions } from "./application";
export { useWalletStore, WalletActions } from "./wallet";
