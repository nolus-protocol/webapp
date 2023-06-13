import { sha256 } from "@cosmjs/crypto";
import { Buffer } from "buffer";
import { useWalletStore } from "@/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { useOracleStore } from "@/stores/oracle";
import { CurrencyUtils } from "@nolus/nolusjs";
import { DECIMALS_AMOUNT, MAX_DECIMALS, ZERO_DECIMALS, SUPPORTED_NETWORKS, NATIVE_NETWORK } from "@/config/env";
import type { Currency, Networks, NetworksInfo } from "@/types/Networks";

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
    const currency = wallet.getCurrencyByTicker(info.ticker!);
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

  public static parseNetworks(ntwrks: Networks) {
    const networks: NetworksInfo = {};

    const assetIcons: {
      [key: string]: string
    } = {};

    for (const k in ntwrks.networks.list) {
      if (SUPPORTED_NETWORKS.includes(k)) {
        if (networks[k] == null) {
          networks[k] = {};
        }

        for (const ck in ntwrks.networks.list[k].currencies) {
          const currency = ntwrks.networks.list[k].currencies[ck];

          if (currency.icon) {
            const a = AssetUtils.getAsset(ntwrks, ck, k);
            assetIcons[a.key] = currency.icon;
          }

          if (currency.native) {
            networks[k][ck] = {
              ...currency.native,
              shortName: currency.native?.ticker,
              ticker: ck,
              native: true,
              ibc_route: []
            }
          }

          if (currency.ibc) {
            const n = ntwrks.networks.list[currency.ibc.network];
            const ibc_route = [];

            const channel = AssetUtils.getChannel(ntwrks.networks.channels, currency.ibc, k);
            ibc_route.push(channel?.ch as string);

            let c = n.currencies[currency.ibc.currency];

            if (c.ibc) {
              const n = ntwrks.networks.list[c.ibc.network];
              const channel2 = AssetUtils.getChannel(ntwrks.networks.channels, c.ibc, currency.ibc.network);
              c = n.currencies[c.ibc.currency];
              ibc_route.push(channel2?.ch as string);
            }

            const ticker = n.currencies[currency.ibc.currency].ibc?.currency ?? currency.ibc.currency;

            networks[k][ticker] = {
              ...c.native!,
              shortName: c.native?.ticker as string,
              ticker: ticker,
              native: false,
              ibc_route
            }
          }
        }
      }
    }

    return {
      assetIcons,
      networks,
      lease: ntwrks.lease
    }
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
    }[], a: string, source: string) {

    const channel = channels.find(
      (item) => {
        return (item.a.network == a && item.b.network == source) || (item.a.network == source && item.b.network == a)
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

  public static getChannels(ntwrks: Networks, key: string, network: string, routes: string[]): string[]{
    const asset = ntwrks.networks.list[network].currencies[key];

    if (asset.ibc) {

      const channel = AssetUtils.getChannel(ntwrks.networks.channels, asset.ibc, network);
      routes.push(channel?.ch as string);

      return AssetUtils.getChannels(ntwrks, asset.ibc?.currency as string, asset.ibc?.network as string, routes);
    }

    return routes;
  }

  public static getLpn(ntwrks: Networks) {
    const lpn = Object.keys(ntwrks.lease.Lpn)[0];
    return AssetUtils.getAsset(ntwrks, lpn as string, NATIVE_NETWORK.symbol as string);
  }

  public static getAsset(ntwrks: Networks, key: string, network: string): { asset: Currency, key: string } {
    const asset = ntwrks.networks.list[network].currencies[key];

    if (asset.ibc) {
      return AssetUtils.getAsset(ntwrks, asset.ibc?.currency as string, asset.ibc?.network as string)
    }

    return { asset, key };
  }

  public static getNative(ntwrks: Networks) {
    const native = ntwrks.lease.Native.id;
    return AssetUtils.getAsset(ntwrks, native as string, NATIVE_NETWORK.symbol as string);
  }

  public static getLease(ntwrks: Networks) {
    const lease = Object.keys(ntwrks.lease.Lease);
    return lease.map((c) => {
      const asset = AssetUtils.getAsset(ntwrks, c as string, NATIVE_NETWORK.symbol as string);
      return asset.key;
    });
  }

  public static getChannel(
    channels: {
      a: {
        network: string,
        ch: string
      },
      b: {
        network: string,
        ch: string
      }
    }[], ibc: {
      network: string;
      currency: string;
    }, network: string) {
    const channel = channels.find(
      (item) => {
        return (item.a.network == network && item.b.network == ibc?.network) || (item.a.network == ibc?.network && item.b.network == network)
      }
    );

    if (channel) {
      const { a, b } = channel;
      if (a.network == network) {
        return a;
      }

      if (b.network == network) {
        return b;
      }
    }
  }

}

