import type { Store } from "../types";
import { Logger, WalletManager, WalletUtils } from "@/common/utils";
import { useApplicationStore } from "../../application";
import { CurrencyUtils } from "@nolus/nolusjs";
import { coin } from "@cosmjs/amino";
import { NATIVE_ASSET, ProtocolsConfig } from "@/config/global";
import { BackendApi, type BalancesResponse } from "@/common/api";

export async function updateBalances(this: Store) {
  try {
    const walletAddress = WalletManager.getWalletAddress() ?? "";
    
    if (!WalletUtils.isAuth() || !walletAddress) {
      this.balances = [];
      this.total_unls = {
        balance: CurrencyUtils.convertCosmosCoinToKeplCoin(coin("0", NATIVE_ASSET.denom))
      };
      return;
    }

    // Fetch all balances from backend - now returns BalancesResponse with balances array
    const response: BalancesResponse = await BackendApi.getBalances(walletAddress);
    
    // Create a map of denom -> amount for easy lookup
    const balanceMap = new Map<string, string>();
    for (const balance of response.balances) {
      balanceMap.set(balance.denom, balance.amount);
    }

    // Build balances array in the expected format for the wallet store
    const app = useApplicationStore();
    const currencies = app.currenciesData;
    const ibcBalances: { balance: ReturnType<typeof CurrencyUtils.convertCosmosCoinToKeplCoin> }[] = [];
    const processedDenoms = new Set<string>();

    for (const key in currencies) {
      const currency = app.currenciesData![key];
      const [ticker, protocol] = key.split("@");

      if (!ProtocolsConfig[protocol]?.currencies?.includes(ticker)) {
        continue;
      }

      const ibcDenom = currency.ibcData;

      if (processedDenoms.has(ibcDenom)) {
        continue;
      }

      processedDenoms.add(ibcDenom);

      // Get amount from backend response, converting from human-readable if needed
      const amount = balanceMap.get(ibcDenom) ?? "0";
      ibcBalances.push({
        balance: CurrencyUtils.convertCosmosCoinToKeplCoin(coin(amount, ibcDenom))
      });
    }

    // Get native balance
    const nativeAmount = balanceMap.get(NATIVE_ASSET.denom) ?? "0";
    const nativeTotal = {
      balance: CurrencyUtils.convertCosmosCoinToKeplCoin(coin(nativeAmount, NATIVE_ASSET.denom))
    };

    this.balances = ibcBalances;
    this.total_unls = nativeTotal;
  } catch (e) {
    Logger.error(e);
    throw new Error(e as string);
  }
}
