import type { ExternalCurrency } from "@/common/types";
import { Oracle, type ProtocolContracts } from "@nolus/nolusjs/build/contracts";

import { Dec } from "@keplr-wallet/unit";
import { CurrencyUtils, NolusClient } from "@nolus/nolusjs";
import { useOracleStore } from "@/common/stores/oracle";
import { useApplicationStore } from "../stores/application";
import { useAdminStore } from "../stores/admin";
import { AppUtils, EnvNetworkUtils } from ".";
import { useWalletStore } from "../stores/wallet";

import {
  DECIMALS_AMOUNT,
  MAX_DECIMALS,
  ZERO_DECIMALS,
  NATIVE_NETWORK,
  NATIVE_ASSET,
  ProtocolsConfig,
  NATIVE_CURRENCY,
  SORT_PROTOCOLS
} from "@/config/global";
import { sha256 } from "@cosmjs/crypto";

export class AssetUtils {
  public static formatNumber(amount: number | string, decimals: number, symbol?: string) {
    const a = Number(amount);
    let sign = "";

    if (a < 0) {
      sign = "-";
    }

    return `${sign}${symbol ?? ""}${new Intl.NumberFormat(NATIVE_CURRENCY.locale, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals
    })
      .format(Math.abs(a))
      .toString()}`;
  }

  public static getBalance(ibcData: string) {
    const wallet = useWalletStore();

    const asset = wallet?.balances.find((item) => item.balance.denom == ibcData);

    if (asset) {
      return asset;
    }

    throw new Error(`Currency not found: ${ibcData}`);
  }

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
    const application = useApplicationStore();
    for (const key in application.currenciesData) {
      const [t, p] = key.split("@");
      if (t == ticker) {
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

      if (application.currenciesData[key].symbol == symbol) {
        return application.currenciesData[key];
      }
    }

    throw new Error(`Currency not found: ${symbol}`);
  }

  public static getCurrencyByDenom(denom: string) {
    const application = useApplicationStore();
    for (const key in application.currenciesData) {
      const [t, p] = key.split("@");
      if (denom == application.currenciesData[key].ibcData) {
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

  public static async parseNetworks() {
    const promises = [];

    const [cosmWasmClient, networks] = await Promise.all([
      NolusClient.getInstance().getCosmWasmClient(),
      AppUtils.getCurrencies()
    ]);

    const admin = useAdminStore();
    const tempNetwork: { [key: string]: ExternalCurrency } = {};
    const assetIcons: {
      [key: string]: string;
    } = {};

    for (const protocolKey in admin.contracts) {
      const fn = async () => {
        const protocol = admin.contracts![protocolKey];

        const oracleContract = new Oracle(cosmWasmClient, protocol.oracle);
        const currencies = await oracleContract.getCurrencies();
        const protocol_currencies = [...ProtocolsConfig[protocolKey].currencies];
        for (const c of currencies) {
          const name = c.ticker.replace(/_/g, "")?.toLocaleLowerCase();
          const pr = protocolKey.split("-").at(0)?.toLocaleLowerCase();
          const key = `${c.ticker}@${protocolKey}`;
          protocol_currencies.push(c.ticker);
          assetIcons[key] = `${networks.icons}/${pr}-${name}.svg` as string;
          tempNetwork[`${c.ticker}@${protocolKey}`] = {
            key,
            name: networks.currencies[c.ticker].name,
            shortName: networks.currencies[c.ticker].shortName,
            symbol: networks.currencies[c.ticker].symbol,
            decimal_digits: c.decimal_digits,
            ticker: networks.currencies[c.ticker].shortName,
            native: c.bank_symbol == NATIVE_ASSET.denom,
            ibcData: c.bank_symbol,
            icon: assetIcons[key],
            coingeckoId: networks.currencies[c.ticker].coinGeckoId
          };
          const maped_key = networks.map[`${c.ticker}@${protocolKey}`];
          if (maped_key) {
            tempNetwork[maped_key] = { ...tempNetwork[`${c.ticker}@${protocolKey}`], key: maped_key };
          }
        }
        ProtocolsConfig[protocolKey].currencies = protocol_currencies;
      };
      promises.push(fn());
    }

    promises.push(AppUtils.getHistoryCurrencies());

    const data = await Promise.all(promises);
    const history = data.at(-1);

    for (const h in history) {
      for (const p in history[h].protocols) {
        const q = history[h];
        const k = `${h}@${p}`;
        tempNetwork[k] = {
          name: q.name,
          symbol: q.symbol,
          ticker: q.ticker,
          decimal_digits: q.decimal_digits,
          icon: q.icon,
          shortName: q.shortName,
          native: q.native,
          coingeckoId: q.coingeckoId,
          key: k,
          ibcData: history[h].protocols[p].ibcData
        } as ExternalCurrency;
      }
    }

    let items: ExternalCurrency[] = [];
    const network: { [key: string]: ExternalCurrency } = {};
    const sorted = Object.values(tempNetwork);

    for (const protocol of SORT_PROTOCOLS) {
      const c = sorted.reverse().filter((item) => {
        const [_key, pr] = item.key.split("@");
        return pr == protocol;
      });
      items = [...items, ...c];
    }

    for (const c of items) {
      network[c.key] = c;
    }

    const result = {
      assetIcons,
      networks: { [NATIVE_NETWORK.key]: network }
    };
    return result;
  }

  static getIbc(path: string) {
    return (
      "ibc/" +
      Buffer.from(sha256(Buffer.from(path)))
        .toString("hex")
        .toUpperCase()
    );
  }

  static getNative() {
    const app = useApplicationStore();

    for (const c in app.currenciesData) {
      if (app.currenciesData[c].native) {
        return app.currenciesData[c];
      }
    }

    throw new Error(`Native currency not found`);
  }
}
