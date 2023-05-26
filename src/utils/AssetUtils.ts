import { sha256 } from "@cosmjs/crypto";
import { Buffer } from "buffer";
import { useWalletStore } from "@/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { useOracleStore } from "@/stores/oracle";
import { CurrencyUtils } from "@nolus/nolusjs";
import { DECIMALS_AMOUNT, MAX_DECIMALS, ZERO_DECIMALS } from "@/config/env";

export class AssetUtils {
  public static makeIBCMinimalDenom(
    sourceChannelId: string[],
    coinMinimalDenom: string
  ): string {
    if (sourceChannelId.length == 0) {
      return coinMinimalDenom;
    }

    let path = sourceChannelId.reduce((a, b) => {
      a += `transfer/${b}/`;
      return a;
    }, "");
    path += `${coinMinimalDenom}`;
    return (
      "ibc/" +
      Buffer.from(sha256(Buffer.from(path)))
        .toString("hex")
        .toUpperCase()
    );
  }

  public static getPriceByTicker(amount: number | string, ticker: string) {
    const wallet = useWalletStore();
    const oracle = useOracleStore();
    const currency = wallet.getCurrencyByTicker(ticker);
    const denom = wallet.getIbcDenomBySymbol(currency.symbol);
    const info = wallet.getCurrencyInfo(denom as string);
    const p = oracle.prices[currency.symbol]?.amount;

    if (!p) {
      return new Dec(0);
    }

    const price = new Dec(p);
    const assetAmount = new Dec(amount, info.coinDecimals);
    return assetAmount.quo(price);
  }

  public static getPriceByDenom(amount: number | string, denom: string) {
    const wallet = useWalletStore();
    const oracle = useOracleStore();
    const info = wallet.getCurrencyInfo(denom as string);
    const currency = wallet.getCurrencyByTicker(info.ticker);
    const p = oracle.prices[currency?.symbol]?.amount;
    if (!p) {
      return new Dec(0);
    }

    const price = new Dec(p);
    const assetAmount = new Dec(amount, info.coinDecimals);
    return assetAmount.quo(price);
  }

  public static getAssetInfo(ticker: string) {
    const wallet = useWalletStore();
    const item = wallet.getCurrencyByTicker(ticker);
    const ibcDenom = wallet.getIbcDenomBySymbol(item.symbol);
    const asset = wallet.getCurrencyInfo(ibcDenom as string);
    return asset;
  }

  public static getAssetInfoByDenom(denom: string) {
    const wallet = useWalletStore();
    const ibcDenom = wallet.getIbcDenomBySymbol(denom);
    const asset = wallet.getCurrencyInfo(ibcDenom as string);
    return asset;
  }

  public static formatCurrentBalance(denom: string, amount: string) {
    const wallet = useWalletStore();
    const asset = wallet.getCurrencyInfo(denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      amount,
      denom,
      asset.coinDenom,
      asset.coinDecimals
    );
  }

  public static formatDecimals(denom: string, amount: string) {
    const a = AssetUtils.getPriceByDenom(amount, denom);
    const info = AssetUtils.getAssetInfoByDenom(denom);
    const parsedAmount  = Number(amount);

    if(a.isZero() && parsedAmount == 0){
      return ZERO_DECIMALS;
    }

    const decimals = AssetUtils.getDecimals(a);

    if(decimals < 0){

      if(info.coinDecimals > MAX_DECIMALS){
        return MAX_DECIMALS;
      }

      return info.coinDecimals;
    }

    return decimals
  }

  public static getDecimals(amount: Dec) {

    for (const item of DECIMALS_AMOUNT) {
      if (amount.gte(new Dec(item.amount))) {
        return item.decimals;
      }
    }
    return -1;
  }
}
