import type { Currency, ExternalCurrency, NetworksInfo } from "@/common/types";
import { Networks, type NetworkData } from "@nolus/nolusjs/build/types/Networks";
import { Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils as NolusAssetUtils } from "@nolus/nolusjs/build/utils/AssetUtils";
import { SUPPORTED_NETWORKS_DATA } from "@/networks/config";
import { useOracleStore } from "@/common/stores/oracle";

import {
  DECIMALS_AMOUNT,
  MAX_DECIMALS,
  ZERO_DECIMALS,
  SUPPORTED_NETWORKS,
  NATIVE_NETWORK,
  NATIVE_ASSET,
  ProtocolsConfig,
  CurrencyMapping,
  NetworksConfig
} from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";

export class AssetUtils {
  //TODO: remove
  public static getPriceByTicker(amount: number | string, ticker: string) {
    const wallet = useWalletStore();
    const oracle = useOracleStore();
    const currency = wallet.getCurrencyByTicker(ticker);
    const denom = wallet.getIbcDenomBySymbol(currency?.symbol);
    const info = wallet.getCurrencyInfo(denom as string);
    const p = oracle.prices[currency?.ibcData as string]?.amount;

    if (!p) {
      return new Dec(0);
    }

    const price = new Dec(p);
    const assetAmount = new Dec(amount, info.coinDecimals);
    return assetAmount.quo(price);
  }

  //TODO: remove
  public static getPriceByDenom(amount: number | string, denom: string) {
    const wallet = useWalletStore();
    const oracle = useOracleStore();
    const info = wallet.getCurrencyInfo(denom as string);
    const p = oracle.prices[denom as string]?.amount;
    if (!p) {
      return new Dec(0);
    }
    const price = new Dec(p);
    const assetAmount = new Dec(amount, info.coinDecimals);
    return assetAmount.mul(price);
  }

  //TODO: remove
  public static getAssetInfo(ticker: string | undefined) {
    const wallet = useWalletStore();
    const item = wallet.getCurrencyByTicker(ticker);
    const ibcDenom = wallet.getIbcDenomBySymbol(item?.symbol);
    const asset = wallet.getCurrencyInfo(ibcDenom as string);
    return asset;
  }

  //TODO: remove
  public static getAssetInfoByDenom(denom: string) {
    const wallet = useWalletStore();
    const asset = wallet.getCurrencyInfo(denom as string);
    return asset;
  }

  public static formatCurrentBalance(denom: string, amount: string) {
    const wallet = useWalletStore();
    const asset = wallet.getCurrencyInfo(denom);
    return CurrencyUtils.convertMinimalDenomToDenom(amount, denom, asset.coinDenom!, asset.coinDecimals);
  }

  public static formatDecimals(denom: string, amount: string) {
    const a = AssetUtils.getPriceByDenom(amount, denom);
    const info = AssetUtils.getAssetInfoByDenom(denom);
    const parsedAmount = Number(amount);

    if (a.isZero() && parsedAmount == 0) {
      return ZERO_DECIMALS;
    }

    const decimals = AssetUtils.getDecimals(a);
    if (decimals < 0) {
      if (info.coinDecimals > MAX_DECIMALS) {
        return MAX_DECIMALS;
      }

      return info.coinDecimals;
    }

    return decimals;
  }

  public static getDecimals(amount: Dec) {
    for (const item of DECIMALS_AMOUNT) {
      if (amount.gte(new Dec(item.amount))) {
        return item.decimals;
      }
    }
    return -1;
  }

  public static parseNetworks(ntwrks: NetworkData) {
    const networks: NetworksInfo = {};

    const assetIcons: {
      [key: string]: string;
    } = {};

    for (const k in ntwrks.networks.list) {
      if (SUPPORTED_NETWORKS.includes(k)) {
        if (networks[k] == null) {
          networks[k] = {};
        }

        const assets: { [key: string]: Currency } = ntwrks.networks.list[k].currencies as {
          [key: string]: Currency;
        };

        if (k == NATIVE_NETWORK.key) {
          for (const p of NolusAssetUtils.getProtocols(ntwrks)) {
            for (const key in ntwrks.networks.list[ntwrks.protocols[p].DexNetwork].currencies) {
              if (!ProtocolsConfig[p].hidden.includes(key)) {
                const ck = `${key}@${p}`;
                assets[ck] = ntwrks.networks.list[ntwrks.protocols[p].DexNetwork].currencies[key] as Currency;
                assetIcons[ck] = ntwrks.networks.list[ntwrks.protocols[p].DexNetwork].currencies[key].icon as string;

                if (CurrencyMapping[key]) {
                  assetIcons[`${CurrencyMapping[key].ticker}@${p}`] = ntwrks.networks.list[
                    ntwrks.protocols[p].DexNetwork
                  ].currencies[key].icon as string;
                }
                assets[ck].ibcData = NolusAssetUtils.makeIBCMinimalDenom(
                  key,
                  ntwrks!,
                  NATIVE_NETWORK.key as Networks,
                  ntwrks.protocols[p].DexNetwork as string
                );
              }
            }
          }
        }

        for (const ck in assets) {
          const currency = assets[ck];
          if (currency.native) {
            if (currency.native.ticker != NATIVE_ASSET.ticker) {
              networks[k][ck] = {
                ...currency.native,
                shortName: currency.native?.ticker,
                ticker: currency.native.ticker,
                native: k == NATIVE_NETWORK.key ? false : true,
                key: `${ck}`,
                ibcData: currency.ibcData ?? currency?.native?.symbol
              };
            }
          }

          if (currency.ibc) {
            const n = ntwrks.networks.list[currency.ibc.network];
            const c = n.currencies[currency.ibc.currency];
            const ticker = n.currencies[currency?.ibc?.currency]?.ibc?.currency ?? currency?.ibc?.currency;
            const hiddenAssets = NetworksConfig[k]?.hidden;

            if (hiddenAssets?.includes(ticker)) {
              continue;
            }

            if (c) {
              networks[k][ck] = {
                ...c.native!,
                shortName: c.native?.ticker as string,
                ticker: ticker,
                native: false,
                key: `${ck}`,
                ibcData: currency.ibcData
              };
            }
          }
        }
      }
    }

    const nolusCurrencies: ExternalCurrency[] = [];
    const nolusMappedCurrencies: { [key: string]: ExternalCurrency } = {};

    for (const key in networks[NATIVE_NETWORK.key]) {
      const ibcData = networks[NATIVE_NETWORK.key][key].ibcData as string;
      if (nolusCurrencies.findIndex((item) => item.ibcData == ibcData) == -1) {
        nolusCurrencies.push(networks[NATIVE_NETWORK.key][key]);
        nolusMappedCurrencies[networks[NATIVE_NETWORK.key][key].key as string] = networks[NATIVE_NETWORK.key][key];
      }
    }

    networks[NATIVE_NETWORK.key] = nolusMappedCurrencies;

    return {
      assetIcons,
      networks
    };
  }
  public static getChannelData(
    channels: {
      a: {
        network: string;
        ch: string;
      };
      b: {
        network: string;
        ch: string;
      };
    }[],
    b: string
  ) {
    const channel = channels.find((item) => {
      return item.b.network == b;
    });

    return channel;
  }

  public static getChannelDataByProtocol(
    channels: {
      a: {
        network: string;
        ch: string;
      };
      b: {
        network: string;
        ch: string;
      };
    }[],
    protocol: string,
    b: string
  ) {
    const channel = channels.find((item) => {
      return item.a.network == protocol && item.b.network == b;
    });

    return channel;
  }

  public static getSourceChannel(
    channels: {
      a: {
        network: string;
        ch: string;
      };
      b: {
        network: string;
        ch: string;
      };
    }[],
    a: string,
    b: string,
    source?: string
  ) {
    if (source) {
      const channel = channels.find((item) => {
        return item.a.network == a && item.b.network == b;
      });

      if (channel) {
        if (channel.a.network == source) {
          return channel.a.ch;
        }

        if (channel.b.network == source) {
          return channel.b.ch;
        }
      }
    }

    const channel = channels.find((item) => {
      return (item.a.network == a && item.b.network == b) || (item.a.network == b && item.b.network == a);
    });

    if (channel) {
      if (channel.a.network == (source ?? b)) {
        return channel.a.ch;
      }

      if (channel.b.network == (source ?? b)) {
        return channel.b.ch;
      }
    }
  }
}
