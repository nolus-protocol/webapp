import type { LeaseData } from "@/common/types";
import type { Coin } from "@cosmjs/proto-signing";
import { ref, onMounted } from "vue";

import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { Lease, Leaser, type LeaserConfig, type LeaseStatus } from "@nolus/nolusjs/build/contracts";
import { WalletManager, AppUtils, Logger, LeaseUtils } from "@/common/utils";
import { IGNORE_LEASES, INTEREST_DECIMALS, MONTHS, NATIVE_ASSET, PERCENT, PERMILLE } from "@/config/global";
import { useAdminStore } from "@/common/stores/admin";
import { Dec } from "@keplr-wallet/unit";
import { useWalletStore } from "../stores/wallet";
import { useOracleStore } from "../stores/oracle";
import { useApplicationStore } from "../stores/application";

export function useLeases(onError: (error: unknown) => void) {
  const leases = ref<LeaseData[]>([]);
  const leaseLoaded = ref(false);

  const getLeases = async () => {
    try {
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const admin = useAdminStore();
      const promises: Promise<
        | {
            leaseAddress: string;
            leaseStatus: LeaseStatus;
            protocol: string;
          }
        | undefined
      >[] = [];
      const protocolPromises = [];

      for (const protocolKey in admin.contracts) {
        const fn = async () => {
          const protocol = admin.contracts![protocolKey];
          const leaserClient = new Leaser(cosmWasmClient, protocol.leaser);
          const openedLeases: string[] = (
            await leaserClient.getCurrentOpenLeasesByOwner(WalletManager.getWalletAddress())
          ).filter((item) => {
            return !IGNORE_LEASES.includes(item);
          });

          for (const leaseAddress of openedLeases) {
            promises.push(fetchLease(leaseAddress, protocolKey));
          }
        };

        protocolPromises.push(fn());
      }

      await Promise.all(protocolPromises);

      const items = ((await Promise.all(promises)) as LeaseData[])
        .filter((item) => {
          if (!item) {
            return false;
          }
          return true;
        })
        .sort((a, b) => (b.leaseData?.timestamp?.getTime() ?? 0) - (a.leaseData?.timestamp?.getTime() ?? 0));
      leases.value = items as LeaseData[];
    } catch (e) {
      onError(e);
      Logger.error(e);
    } finally {
      leaseLoaded.value = true;
    }
  };

  onMounted(async () => {
    await getLeases();
  });

  return { leases, leaseLoaded, getLeases };
}

export function useLease(leaseAddress: string, onError: (error: unknown) => void) {
  const getLease = async () => {
    try {
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, leaseAddress);
      const leaseInfo: LeaseStatus = await leaseClient.getLeaseStatus();

      return {
        leaseAddress,
        leaseStatus: leaseInfo
      } as {
        leaseAddress: string;
        leaseStatus: LeaseStatus;
      };
    } catch (e) {
      onError(e);
    }
  };

  onMounted(async () => {
    await getLease();
  });

  return { getLease };
}

export function useLeaseConfig(protocol: string, onError: (error: unknown) => void) {
  const config = ref<LeaserConfig>();

  const getLeaseConfig = async () => {
    try {
      const admin = useAdminStore();
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaserClient = new Leaser(cosmWasmClient, admin.contracts![protocol].leaser);
      config.value = await leaserClient.getLeaserConfig();
    } catch (e) {
      onError(e);
    }
  };

  onMounted(async () => {
    await getLeaseConfig();
  });

  return { getLeaseConfig, config };
}

async function fetchLease(leaseAddress: string, protocolKey: string): Promise<LeaseData> {
  const [cosmWasmClient, etl] = await Promise.all([
    NolusClient.getInstance().getCosmWasmClient(),
    AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)
  ]);

  const walletStore = useWalletStore();
  const oracleStore = useOracleStore();

  const leaseClient = new Lease(cosmWasmClient, leaseAddress);

  const [leaseInfo, balancesReq, leaseData] = await Promise.all([
    leaseClient.getLeaseStatus(),
    fetch(`${etl.api}/cosmos/bank/v1beta1/balances/${leaseAddress}`),
    LeaseUtils.getLeaseData(leaseAddress)
  ]);

  const [balancesData] = await Promise.all([balancesReq.json()]);
  const debt = LeaseUtils.getDebt(leaseInfo?.opened);
  const balances = getLeaseBalances(leaseInfo, protocolKey, balancesData.balances);

  let additionalInterest = new Dec(0);
  let interestDue = new Dec(0);
  let interest = new Dec(0);
  let liquidation = new Dec(0);
  let pnlPercent = new Dec(0);
  let pnlAmount = new Dec(0);

  if (leaseInfo.opened) {
    const principal_due = new Dec(leaseInfo.opened.principal_due.amount);
    const loanInterest = new Dec(leaseInfo.opened.loan_interest_rate / PERMILLE).add(
      new Dec(leaseInfo.opened.margin_interest_rate / PERCENT)
    );

    additionalInterest = LeaseUtils.calculateAditionalDebt(principal_due, loanInterest);

    interestDue = new Dec(leaseInfo.opened.overdue_margin.amount)
      .add(new Dec(leaseInfo.opened.overdue_interest.amount))
      .add(new Dec(leaseInfo.opened.due_margin.amount))
      .add(new Dec(leaseInfo.opened.due_interest.amount))
      .add(additionalInterest);

    interest = new Dec(
      (Number(leaseInfo.opened.loan_interest_rate) + Number(leaseInfo.opened.margin_interest_rate)) /
        Math.pow(10, INTEREST_DECIMALS) /
        MONTHS
    );

    const unitAssetInfo = walletStore.getCurrencyByTicker(leaseInfo.opened.amount.ticker);
    const stableAssetInfo = walletStore.getCurrencyByTicker(leaseInfo.opened.principal_due.ticker);

    const unitAsset = new Dec(leaseInfo.opened.amount.amount, Number(unitAssetInfo!.decimal_digits));
    const stableAsset = new Dec(leaseInfo.opened.principal_due.amount, Number(stableAssetInfo!.decimal_digits));
    liquidation = LeaseUtils.calculateLiquidation(stableAsset, unitAsset);
  }

  if (leaseInfo.opened || leaseInfo.paid) {
    const lease = leaseInfo.opened ?? leaseInfo.paid;
    const unitAssetInfo = walletStore.getCurrencyByTicker(lease!.amount.ticker);
    const unitAsset = new Dec(lease!.amount.amount, Number(unitAssetInfo!.decimal_digits));

    const currentPrice = new Dec(oracleStore.prices?.[unitAssetInfo!.ibcData as string]?.amount ?? "0");
    let currentAmount = unitAsset.mul(currentPrice);

    for (const b of balances ?? []) {
      const balance = new Dec(b.amount, Number(b.decimals));
      currentAmount = currentAmount.add(balance);
    }

    if (leaseData) {
      pnlAmount = currentAmount.sub(debt).sub(leaseData?.downPayment).add(leaseData?.downPaymentFee);
      if (leaseData.downPayment.isPositive()) {
        pnlPercent = pnlAmount.quo(leaseData?.downPayment).mul(new Dec(100));
      }
    }
  }

  return {
    pnlAmount,
    pnlPercent,
    interest,
    interestDue,
    liquidation,
    additionalInterest,
    debt,
    leaseAddress: leaseAddress,
    leaseStatus: leaseInfo,
    balances,
    protocol: protocolKey,
    leaseData
  };
}

function getLeaseBalances(leaseInfo: LeaseStatus, protocolKey: string, balances: Coin[]) {
  const disable = [NATIVE_ASSET.denom];
  const ticker = leaseInfo?.paid?.amount.ticker;
  const walletStore = useWalletStore();
  const app = useApplicationStore();

  if (ticker) {
    disable.push(app.currenciesData![`${ticker}@${protocolKey}`].ibcData as string);
  }

  return balances
    ?.filter((item) => {
      if (disable.includes(item.denom)) {
        return false;
      }
      return true;
    })
    .map((item) => {
      const currency = walletStore.currencies[item.denom];

      return {
        amount: item.amount,
        icon: app.assetIcons?.[currency.ticker] as string,
        decimals: currency.decimal_digits,
        shortName: currency.shortName
      };
    });
}
