import type { LeaseData } from "@/common/types";
import type { Coin } from "@cosmjs/proto-signing";
import { ref, onMounted, watch } from "vue";

import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import {
  Lease,
  Leaser,
  type CloseOngoingState,
  type LeaserConfig,
  type LeaseStatus
} from "@nolus/nolusjs/build/contracts";
import { AppUtils, Logger, LeaseUtils, AssetUtils, WalletManager } from "@/common/utils";
import {
  Contracts,
  IGNORE_LEASES,
  INTEREST_DECIMALS,
  MONTHS,
  NATIVE_ASSET,
  PERCENT,
  PERMILLE,
  PositionTypes,
  ProtocolsConfig
} from "@/config/global";
import { useAdminStore } from "@/common/stores/admin";
import { Dec } from "@keplr-wallet/unit";
import { useOracleStore } from "../stores/oracle";
import { useApplicationStore } from "../stores/application";
import { useWalletStore } from "../stores/wallet";
import { Intercom } from "../utils/Intercom";
import { RouteNames } from "@/router";
import { useRouter } from "vue-router";
import type { OpenedOngoingState } from "@nolus/nolusjs/build/contracts/types/OpenedOngoingState";

export function useLeases(onError: (error: unknown) => void) {
  const leases = ref<LeaseData[]>([]);
  const leaseLoaded = ref(false);
  const wallet = useWalletStore();
  const app = useApplicationStore();

  const getLeases = async () => {
    try {
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();

      const admin = useAdminStore();
      const protocols = Contracts.protocolsFilter[app.protocolFilter];

      const promises: Promise<
        | {
            leaseAddress: string;
            leaseStatus: LeaseStatus;
            protocol: string;
          }
        | undefined
      >[] = [];
      const protocolPromises = [];
      const paginate = 50;
      for (const protocolKey in admin.contracts) {
        if (protocols.hold.includes(protocolKey)) {
          const fn = async () => {
            const protocol = admin.contracts![protocolKey];
            const leaserClient = new Leaser(cosmWasmClient, protocol.leaser);

            const openedLeases: string[] = (
              await leaserClient.getCurrentOpenLeasesByOwner(WalletManager.getWalletAddress())
            ).filter((item) => {
              return !IGNORE_LEASES.includes(item);
            });

            while (openedLeases.length > 0) {
              const leases = openedLeases.splice(0, paginate);
              const ps = [];

              for (const leaseAddress of leases) {
                const fn = fetchLease(leaseAddress, protocolKey);
                ps.push(fn);
                promises.push(fn);
              }
              await Promise.all(ps);
            }
          };

          protocolPromises.push(fn());
        }
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
      const attributes: {
        PositionsCount: number;
        PositionsLastOpened?: Date;
      } = {
        PositionsCount: leases.value.length
      };

      if (leases.value.length > 0) {
        attributes.PositionsLastOpened = leases.value[0].leaseData?.timestamp;
      }
      Intercom.update(attributes);
    } catch (e) {
      onError(e);
      Logger.error(e);
    } finally {
      leaseLoaded.value = true;
    }
  };

  onMounted(async () => {
    if (wallet.wallet) {
      await getLeases();
    } else {
      leaseLoaded.value = true;
    }
  });

  watch(
    () => [wallet.wallet?.address, app.protocolFilter],
    async () => {
      if (wallet.wallet) {
        await getLeases();
      }
    }
  );

  return { leases, leaseLoaded, getLeases };
}

export function useLease(leaseAddress: string, protocol: string, onError: (error: unknown) => void, period?: boolean) {
  const lease = ref<LeaseData>();
  const leaseLoaded = ref(false);
  const router = useRouter();

  const getLease = async () => {
    try {
      let secs = period ? await AppUtils.getDueProjectionSecs() : null;
      const l = await fetchLease(leaseAddress, protocol.toUpperCase(), secs?.due_projection_secs);
      if (l.leaseStatus.closed) {
        router.push(`/${RouteNames.LEASES}`);
        return;
      }
      lease.value = l;
    } catch (e) {
      onError(e);
      Logger.error(e);
    } finally {
      leaseLoaded.value = true;
    }
  };

  onMounted(() => {
    getLease();
  });

  return { lease, leaseLoaded, getLease };
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

async function fetchLease(leaseAddress: string, protocolKey: string, period?: number): Promise<LeaseData> {
  const [cosmWasmClient, etl] = await Promise.all([
    NolusClient.getInstance().getCosmWasmClient(),
    AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)
  ]);

  const oracleStore = useOracleStore();
  const app = useApplicationStore();
  let lpn = AssetUtils.getLpnByProtocol(protocolKey);

  const leaseClient = new Lease(cosmWasmClient, leaseAddress);

  const [leaseInfo, balancesReq, leaseData] = await Promise.all([
    leaseClient.getLeaseStatus(period),
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
  let fee = leaseData?.fee ?? new Dec(0);
  let unitAsset = new Dec(0);
  let stableAsset = new Dec(0);

  leaseData.downpaymentTicker = leaseData.downpaymentTicker ?? leaseInfo.opening?.downpayment.ticker;

  switch (ProtocolsConfig[protocolKey!]?.type) {
    case PositionTypes.long: {
      leaseData.leasePositionTicker = leaseData.leasePositionTicker ?? leaseInfo.opening?.currency;
      break;
    }
    case PositionTypes.short: {
      leaseData.leasePositionTicker = leaseData.leasePositionTicker ?? leaseInfo.opening?.loan?.ticker;
      break;
    }
  }

  if (!leaseData.ls_asset_symbol) {
    leaseData.ls_asset_symbol = leaseData.leasePositionTicker;
  }

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

    const ticker = leaseInfo.opened.amount.ticker;
    const unitAssetInfo = app.currenciesData![`${ticker!}@${protocolKey}`];

    const stableTicker = leaseInfo.opened.principal_due.ticker;
    const stableAssetInfo = app.currenciesData![`${stableTicker!}@${protocolKey}`];

    unitAsset = new Dec(leaseInfo.opened.amount.amount, Number(unitAssetInfo!.decimal_digits));
    stableAsset = new Dec(leaseInfo.opened.principal_due.amount, Number(stableAssetInfo!.decimal_digits));

    switch (ProtocolsConfig[protocolKey].type) {
      case PositionTypes.long: {
        liquidation = LeaseUtils.calculateLiquidation(stableAsset, unitAsset);
        break;
      }
      case PositionTypes.short: {
        liquidation = LeaseUtils.calculateLiquidationShort(unitAsset, stableAsset);
        break;
      }
    }
  }

  if (leaseInfo.opened || leaseInfo.closing) {
    const lease = leaseInfo.opened ?? leaseInfo.closing;
    const ticker = lease!.amount.ticker;

    const unitAssetInfo = app.currenciesData![`${ticker!}@${protocolKey}`];
    const unitAsset = new Dec(lease!.amount.amount, Number(unitAssetInfo!.decimal_digits));

    const currentPrice = new Dec(oracleStore.prices?.[unitAssetInfo!.ibcData as string]?.amount ?? "0");
    let currentAmount = unitAsset.mul(currentPrice);

    if (!((leaseInfo.opened?.status as OpenedOngoingState)?.in_progress as CloseOngoingState)?.close) {
      for (const b of balances ?? []) {
        const lpnPrice = new Dec(oracleStore.prices[b.key]?.amount);
        const balance = new Dec(b.amount, Number(b.decimals)).mul(lpnPrice);
        currentAmount = currentAmount.add(balance);
      }
    }
    if (leaseData) {
      const lpnPrice = new Dec(oracleStore.prices[lpn.ibcData]?.amount);
      pnlAmount = currentAmount
        .sub(debt.mul(lpnPrice))
        .sub(leaseData?.downPayment)
        .add(fee)
        .sub(leaseData?.repayment_value);
      if (leaseData.downPayment.isPositive()) {
        pnlPercent = pnlAmount.quo(leaseData?.downPayment.add(leaseData?.repayment_value)).mul(new Dec(100));
      }
    }
  }

  return {
    stableAsset,
    unitAsset,
    fee,
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
  const ticker = leaseInfo?.closing?.amount.ticker;
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
      const asset = AssetUtils.getCurrencyByDenom(item.denom);
      const [ticker] = asset.key.split("@");
      const currency = app.currenciesData![`${ticker}@${protocolKey}`];

      return {
        amount: item.amount,
        icon: currency.icon,
        decimals: currency.decimal_digits,
        shortName: currency.shortName,
        key: `${ticker}@${protocolKey}`
      };
    });
}
