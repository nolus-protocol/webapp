import type { NetworksInfo } from "@/types/Networks";
import type { ExternalCurrencyType } from "@/types/CurreciesType";
import { Networks, type NetworkData, Protocols } from "@nolus/nolusjs/build/types/Networks";
import { sha256 } from "@cosmjs/crypto";
import { Buffer } from "buffer";
import { useWalletStore } from "@/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { useOracleStore } from "@/stores/oracle";
import { CurrencyUtils } from "@nolus/nolusjs";
import { DECIMALS_AMOUNT, MAX_DECIMALS, ZERO_DECIMALS, SUPPORTED_NETWORKS, NATIVE_NETWORK, NATIVE_ASSET } from "@/config/env";
import { SUPPORTED_NETWORKS_DATA } from "@/networks/config";
import { AssetUtils as NolusAssetUtils } from "@nolus/nolusjs/build/utils/AssetUtils";

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
    const denom = wallet.getIbcDenomBySymbol(currency?.symbol);
    const info = wallet.getCurrencyInfo(denom as string);
    const p = oracle.prices[currency?.symbol as string]?.amount;

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
    const currency = wallet.getCurrencyByTicker(info.ticker!);
    const p = oracle.prices[currency?.symbol as string]?.amount;
    if (!p) {
      return new Dec(0);
    }
    const price = new Dec(p);
    const assetAmount = new Dec(amount, info.coinDecimals);
    return assetAmount.mul(price);
  }

  public static getAssetInfo(ticker: string | undefined) {
    const wallet = useWalletStore();
    const item = wallet.getCurrencyByTicker(ticker);
    const ibcDenom = wallet.getIbcDenomBySymbol(item?.symbol);
    const asset = wallet.getCurrencyInfo(ibcDenom as string);
    return asset;
  }

  public static getAssetInfoByDenom(denom: string) {
    const wallet = useWalletStore();
    const asset = wallet.getCurrencyInfo(denom as string);
    return asset;
  }

  public static formatCurrentBalance(denom: string, amount: string) {
    const wallet = useWalletStore();
    const asset = wallet.getCurrencyInfo(denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      amount,
      denom,
      asset.coinDenom!,
      asset.coinDecimals
    );
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

  public static parseNetworks(ntwrks: NetworkData) {
    const networks: NetworksInfo = {};

    const assetIcons: {
      [key: string]: string
    } = {};

    for (const k in ntwrks.networks.list) {
      if (SUPPORTED_NETWORKS.includes(k)) {
        if (networks[k] == null) {
          networks[k] = {};
        }

        let assets = ntwrks.networks.list[k].currencies;

        if (k == NATIVE_NETWORK.key) {
          for (const p of NolusAssetUtils.getProtocols(ntwrks)) {
            for (const key in ntwrks.networks.list[p].currencies) {
              const ck = `${key}@${p}`;
              assets[ck] = ntwrks.networks.list[p].currencies[key];
              assetIcons[ck] = ntwrks.networks.list[p].currencies[key].icon as string;
              assets[ck].ibcData = NolusAssetUtils.makeIBCMinimalDenom(key, ntwrks!, NATIVE_NETWORK.key as Networks, p as Protocols);

            };
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
                ibcData: currency.ibcData
              }
            }
          }

          if (currency.ibc) {
            const n = ntwrks.networks.list[currency.ibc.network];
            const c = n.currencies[currency.ibc.currency];
            const ticker = n.currencies[currency?.ibc?.currency]?.ibc?.currency ?? currency?.ibc?.currency;
            if (c) {
              networks[k][ck] = {
                ...c.native!,
                shortName: c.native?.ticker as string,
                ticker: ticker,
                native: false,
                key: `${ck}`,
                ibcData: currency.ibcData
              }
            }
          }
        }
      }
    }

    const nolusCurrencies: ExternalCurrencyType[] = [];
    const nolusMappedCurrencies: { [key: string]: ExternalCurrencyType } = {};

    for (const key in networks[NATIVE_NETWORK.key]) {
      const ibcData = networks[NATIVE_NETWORK.key][key].ibcData as string;
      if (nolusCurrencies.findIndex((item) => item.ibcData == ibcData) == -1) {
        nolusCurrencies.push(networks[NATIVE_NETWORK.key][key]);
        nolusMappedCurrencies[networks[NATIVE_NETWORK.key][key].key as string] = networks[NATIVE_NETWORK.key][key];
      };
    }

    networks[NATIVE_NETWORK.key] = nolusMappedCurrencies

    return {
      assetIcons,
      networks,
    }
  }

  public static getChannelData(channels: {
    a: {
      network: string,
      ch: string
    },
    b: {
      network: string,
      ch: string
    }
  }[], b: string) {
    const channel = channels.find(
      (item) => {
        return item.b.network == b;
      }
    );

    return channel;
  }

  public static getSourceChannelData(channels: {
    a: {
      network: string,
      ch: string
    },
    b: {
      network: string,
      ch: string
    }
  }[], b: string): {
    a: {
      network: string,
      ch: string
    },
    b: {
      network: string,
      ch: string
    }
  } | undefined {
    const networkInfo = SUPPORTED_NETWORKS_DATA[b as keyof typeof SUPPORTED_NETWORKS_DATA];

    const channel = channels.find(
      (item) => {
        return item.b.network == b;
      }
    );

    if (networkInfo.forward) {
      return AssetUtils.getSourceChannelData(channels, channel!.a.network);
    }

    return channel;
  }

  public static getSourceChannel(
    channels: {
      a: {
        network: string,
        ch: string
      },
      b: {
        network: string,
        ch: string
      }
    }[], a: string, b: string, source?: string) {
    if (source) {
      const channel = channels.find(
        (item) => {
          return (item.a.network == a && item.b.network == b)
        }
      );

      if (channel) {
        if (channel.a.network == source) {
          return channel.a.ch;
        }

        if (channel.b.network == source) {
          return channel.b.ch;
        }
      }
    }

    const channel = channels.find(
      (item) => {
        return (item.a.network == a && item.b.network == b) || (item.a.network == b && item.b.network == a)
      }
    );

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

