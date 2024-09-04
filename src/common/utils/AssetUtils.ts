import type { Currency, ExternalCurrency, NetworksInfo } from "@/common/types";
import type { ProtocolContracts } from "@nolus/nolusjs/build/contracts";

import { Networks, type NetworkData } from "@nolus/nolusjs/build/types/Networks";
import { Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils as NolusAssetUtils } from "@nolus/nolusjs/build/utils/AssetUtils";
import { useOracleStore } from "@/common/stores/oracle";
import { ASSETS, CurrencyDemapping, CurrencyMapping } from "@/config/currencies";
import { useApplicationStore } from "../stores/application";
import { useAdminStore } from "../stores/admin";
import { EnvNetworkUtils } from ".";

import {
  DECIMALS_AMOUNT,
  MAX_DECIMALS,
  ZERO_DECIMALS,
  SUPPORTED_NETWORKS,
  NATIVE_NETWORK,
  NATIVE_ASSET,
  ProtocolsConfig
} from "@/config/global";

export class AssetUtils {
  public static getPriceByDenom(amount: number | string, denom: string) {
    const oracle = useOracleStore();
    const info = AssetUtils.getCurrencyByDenom(denom as string);
    const p = oracle.prices[denom as string]?.amount;
    if (!p) {
      return new Dec(0);
    }
    const price = new Dec(p);
    const assetAmount = new Dec(amount, info.decimal_digits);
    return assetAmount.mul(price);
  }

  public static getCurrency(denom: string, protocol: string) {
    const application = useApplicationStore();
    for (const key in application.currenciesData) {
      const [_ticker, pr] = application.currenciesData[key].key.split("@");
      if (application.currenciesData[key].ibcData == denom && protocol == pr) {
        return application.currenciesData[key];
      }
    }

    throw new Error(`Currency not found: ${denom} ${protocol}`);
  }

  public static getCurrencyByTicker(ticker: string) {
    ticker = CurrencyDemapping[ticker]?.ticker ?? ticker;
    const application = useApplicationStore();
    for (const key in application.currenciesData) {
      const [t, p] = key.split("@");
      const currencies = ProtocolsConfig[p].currencies;

      if (t == ticker && currencies.includes(t)) {
        return application.currenciesData[key];
      }
    }

    throw new Error(`Currency not found: ${ticker}`);
  }

  public static getCurrencyBySymbol(symbol: string) {
    const application = useApplicationStore();
    for (const key in application.currenciesData) {
      const [t, p] = key.split("@");
      const currencies = ProtocolsConfig[p].currencies;

      if (application.currenciesData[key].symbol == symbol && currencies.includes(t)) {
        return application.currenciesData[key];
      }
    }

    throw new Error(`Currency not found: ${symbol}`);
  }

  public static getCurrencyByDenom(denom: string) {
    const application = useApplicationStore();
    for (const key in application.currenciesData) {
      const [t, p] = key.split("@");
      const currencies = ProtocolsConfig[p].currencies;

      if (denom == application.currenciesData[key].ibcData && currencies.includes(t)) {
        return application.currenciesData[key];
      }
    }

    throw new Error(`Currency not found: ${denom}`);
  }

  public static getProtocolByContract(contract: string) {
    const admin = useAdminStore();
    const chain = EnvNetworkUtils.getStoredNetworkName();
    for (const protocol in admin.protocols[chain] ?? {}) {
      const c = admin.protocols[chain];
      for (const key in c?.[protocol] ?? {}) {
        const p = c?.[protocol][key as keyof ProtocolContracts];
        if (p == contract) {
          return protocol;
        }
      }
    }
    throw new Error(`Contract not found ${contract}`);
  }

  public static getLpnByProtocol(protocol: string) {
    const app = useApplicationStore();
    for (const lpn of app.lpn ?? []) {
      const [_, p] = lpn.key.split("@");
      if (p == protocol) {
        return lpn;
      }
    }
    throw new Error(`Lpn not found ${protocol}`);
  }

  public static formatCurrentBalance(denom: string, amount: string) {
    const asset = AssetUtils.getCurrencyByDenom(denom);
    return CurrencyUtils.convertMinimalDenomToDenom(amount, denom, asset.ibcData!, asset.decimal_digits);
  }

  public static formatDecimals(denom: string, amount: string) {
    const a = AssetUtils.getPriceByDenom(amount, denom);
    const info = AssetUtils.getCurrencyByDenom(denom);
    const parsedAmount = Number(amount);

    if (a.isZero() && parsedAmount == 0) {
      return ZERO_DECIMALS;
    }

    const decimals = AssetUtils.getDecimals(a);
    if (decimals < 0) {
      if (info.decimal_digits > MAX_DECIMALS) {
        return MAX_DECIMALS;
      }

      return info.decimal_digits;
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
              const ck = `${key}@${p}`;
              assets[ck] = ntwrks.networks.list[ntwrks.protocols[p].DexNetwork].currencies[key] as Currency;
              assetIcons[ck] = ntwrks.networks.list[ntwrks.protocols[p].DexNetwork].currencies[key].icon as string;

              if (CurrencyMapping[key]) {
                assetIcons[`${CurrencyMapping[key].ticker}@${p}`] = ntwrks.networks.list[ntwrks.protocols[p].DexNetwork]
                  .currencies[key].icon as string;
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

        for (const ck in assets) {
          const currency = assets[ck];
          const [ti, pr] = ck.split("@");

          if (currency.native) {
            if (currency.native.ticker != NATIVE_ASSET.ticker) {
              networks[k][ck] = {
                ...currency.native,
                icon: assetIcons[ck],
                decimal_digits: Number(currency.native!.decimal_digits),
                shortName: CurrencyDemapping[ck]?.name ?? currency.native?.ticker,
                ticker: currency.native.ticker,
                native: k == NATIVE_NETWORK.key ? false : true,
                key: `${ck}`,
                ibcData: currency.ibcData ?? currency?.native?.symbol,
                coingeckoId: ASSETS[ti as keyof typeof ASSETS].coinGeckoId
              };
            }
          }

          if (currency.ibc) {
            const n = ntwrks.networks.list[currency.ibc.network];
            const c = n.currencies[currency.ibc.currency];
            const ticker = n.currencies[currency?.ibc?.currency]?.ibc?.currency ?? currency?.ibc?.currency;

            if (c) {
              c;
              networks[k][ck] = {
                ...c.native!,
                icon: assetIcons[ck],
                decimal_digits: Number(c.native!.decimal_digits),
                shortName: CurrencyMapping[ti]?.name ?? (c.native?.ticker as string),
                ticker: ticker,
                native: false,
                key: `${ck}`,
                ibcData: currency.ibcData,
                coingeckoId: ASSETS[ticker as keyof typeof ASSETS].coinGeckoId
              };
            }
          }
        }
      }
    }

    const nolusCurrencies: ExternalCurrency[] = [];
    const nolusMappedCurrencies: { [key: string]: ExternalCurrency } = {};

    for (const key in networks[NATIVE_NETWORK.key]) {
      nolusCurrencies.push(networks[NATIVE_NETWORK.key][key]);
      nolusMappedCurrencies[networks[NATIVE_NETWORK.key][key].key as string] = networks[NATIVE_NETWORK.key][key];
    }

    networks[NATIVE_NETWORK.key] = nolusMappedCurrencies;

    return {
      assetIcons,
      networks
    };
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
