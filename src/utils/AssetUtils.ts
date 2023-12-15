import type { Currency, Networks, NetworksInfo } from "@/types/Networks";
import { sha256 } from "@cosmjs/crypto";
import { Buffer } from "buffer";
import { useWalletStore } from "@/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { useOracleStore } from "@/stores/oracle";
import { ChainConstants, CurrencyUtils } from "@nolus/nolusjs";
import { DECIMALS_AMOUNT, MAX_DECIMALS, ZERO_DECIMALS, SUPPORTED_NETWORKS, NATIVE_NETWORK, defaultProtocol } from "@/config/env";
import { SUPPORTED_NETWORKS_DATA } from "@/networks/config";

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

        let assets = ntwrks.networks.list[k].currencies;
        //TODO: fix native
        if(k == NATIVE_NETWORK.key){
          assets = ntwrks.networks.list[defaultProtocol].currencies;
        }

        for (const ck in assets) {
          const currency = assets[ck];

          if (currency.icon) {
            const a = AssetUtils.getAsset(ntwrks, ck, k);
            assetIcons[a.key] = currency.icon;
          }

          if (currency.native) {
            networks[k][ck] = {
              ...currency.native,
              forward: currency.forward,
              shortName: currency.native?.ticker,
              ticker: ck,
              native: true,
              ibc_route: []
            }
          }

          if (currency.ibc) {
            const n = ntwrks.networks.list[currency.ibc.network];
            const ibc_route = [];

            const channel = AssetUtils.getSourceChannel(ntwrks.networks.channels, k, currency.ibc.network, k);

            ibc_route.push(channel as string);

            let c = n.currencies[currency.ibc.currency];

            if (c?.ibc) {
              const n = ntwrks.networks.list[c.ibc.network];
              const channel2 = AssetUtils.getChannel(ntwrks.networks.channels, c.ibc, currency.ibc.network);
              c = n.currencies[c.ibc.currency];
              ibc_route.push(channel2?.ch as string);
            }

            const ticker = n.currencies[currency?.ibc?.currency]?.ibc?.currency ?? currency?.ibc?.currency;

            if (c) {
              networks[k][ticker] = {
                ...c.native!,
                forward: currency.forward,
                shortName: c.native?.ticker as string,
                ticker: ticker,
                native: false,
                ibc_route
              }
            }
          }
        }
      }
    }
    return {
      assetIcons,
      networks,
      lease: AssetUtils.getLease(ntwrks)
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

  public static getChannels(ntwrks: Networks, key: string, network: string, routes: string[]): string[] {
    const asset = ntwrks.networks.list[network].currencies[key];

    if (asset?.ibc) {

      const channel = AssetUtils.getChannel(ntwrks.networks.channels, asset.ibc, network);
      routes.push(channel?.ch as string);

      return AssetUtils.getChannels(ntwrks, asset.ibc?.currency as string, asset.ibc?.network as string, routes);
    }

    return routes;
  }

  public static getAsset(ntwrks: Networks, key: string, network: string): { asset: Currency; key: string } {
    const asset = ntwrks.networks.list[network].currencies[key];

    if (asset?.ibc) {
      return AssetUtils.getAsset(ntwrks, asset.ibc?.currency as string, asset.ibc?.network as string);
    }

    return { asset, key };
  }

  public static getNative(ntwrks: Networks, protocol: string = 'OSMOSIS') {
    const pr = AssetUtils.getProtocol(ntwrks, protocol);
    const native = pr.Native['dex_currency'];
    return AssetUtils.getAsset(ntwrks, native as string, ChainConstants.CHAIN_KEY as string);
  }

  public static getLpn(ntwrks: Networks, protocol: string = 'OSMOSIS') {
    const pr = AssetUtils.getProtocol(ntwrks, protocol);
    const lpn = pr.Lpn;
    return lpn.dex_currency;
  }

  public static getLease(ntwrks: Networks, protocol: string = 'OSMOSIS') {
    const pr = AssetUtils.getProtocol(ntwrks, protocol);
    const lease = Object.keys(pr.Lease);
    return lease.map((c) => {
      const asset = AssetUtils.getAsset(ntwrks, c as string, NATIVE_NETWORK.key as string);
      return asset.key;
    });
  }

  private static getProtocol(ntwrks: Networks, protocol: string) {
    for (const key in ntwrks.protocols) {
      if (ntwrks.protocols[key].DexNetwork == protocol) {
        return ntwrks.protocols[key];
      }
    }
    throw 'not supported protocol';
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

