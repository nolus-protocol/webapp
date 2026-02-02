import type { Store } from "../types";
import type { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

import { IGNORE_LEASE_ASSETS_STABLES, NATIVE_ASSET, NATIVE_NETWORK, ProtocolsConfig } from "@/config/global";
import { Logger } from "@/common/utils";
import { getNativeCurrency } from "@/common/utils/CurrencyLookup";
import { parseNetworks } from "@/common/utils/NetworkParser";
import { AssetUtils as NolusAssetUtils } from "@nolus/nolusjs/build/utils/AssetUtils";
import { NolusClient } from "@nolus/nolusjs";
import { Lpp, Oracle } from "@nolus/nolusjs/build/contracts";
import { useConfigStore } from "../../config";

export async function loadCurrennncies(this: Store) {
  try {
    const [cosmWasmClient, data] = await Promise.all([
      NolusClient.getInstance().getCosmWasmClient(),
      parseNetworks()
    ]);
    this.currenciesData = data.networks[NATIVE_NETWORK.key];
    const nativeCurrency = getNativeCurrency();
    const lease: { [key: string]: string[] } = {};
    const leasesCurrencies = new Set<string>();
    const lpnPromises = [];
    const leasePromises = [];

    const configStore = useConfigStore();
    this.assetIcons = data.assetIcons;
    this.networks = data.networks;
    this.map_keys = data.map_keys;
    // Use protocols from backend config, filtered by ProtocolsConfig for UI settings
    const backendProtocols = Object.keys(configStore.contracts);
    this.protocols = backendProtocols.filter((p) => ProtocolsConfig[p] !== undefined);
    this.lpn = [];

    this.native = {
      icon: NATIVE_ASSET.icon,
      name: nativeCurrency.name,
      shortName: nativeCurrency.ticker,
      symbol: nativeCurrency.symbol,
      decimal_digits: Number(nativeCurrency.decimal_digits),
      ticker: nativeCurrency.ticker,
      native: true,
      key: nativeCurrency.ticker,
      ibcData: nativeCurrency.symbol,
      coingeckoId: nativeCurrency.coingeckoId
    };
    for (const protocol of this.protocols) {
      if (ProtocolsConfig[protocol]?.ignore) continue;
      // Skip if protocol contracts not available from backend
      if (!configStore.contracts[protocol]?.lpp) {
        Logger.warn(`Skipping protocol ${protocol}: contracts not available`);
        continue;
      }
      lease[protocol] = [];
      lpnPromises.push(
        getLpn(cosmWasmClient, protocol, configStore.contracts).then((lpn) => {
          return data.networks[NATIVE_NETWORK.key][`${lpn}@${protocol}`];
        })
      );
      leasePromises.push(
        getLease(cosmWasmClient, protocol, configStore.contracts).then((leases) => {
          for (const l of leases) {
            lease[protocol].push(l);
            leasesCurrencies.add(l);
          }
        })
      );
    }
    const [lpns] = await Promise.all([Promise.all(lpnPromises), Promise.all(leasePromises)]);
    this.lpn = lpns;
    this.lease = lease;
    this.leasesCurrencies = Array.from(leasesCurrencies).filter((item) => !IGNORE_LEASE_ASSETS_STABLES.includes(item));
  } catch (e) {
    Logger.error(e);
  }
}

type Contracts = { [key: string]: { oracle: string; lpp: string; leaser: string; profit: string } };

async function getLpn(client: CosmWasmClient, protocol: string, contracts: Contracts) {
  const lppClient = new Lpp(client, contracts[protocol].lpp);
  return lppClient.getLPN();
}

async function getLease(client: CosmWasmClient, protocol: string, contracts: Contracts) {
  const oracleClient = new Oracle(client, contracts[protocol].oracle);
  const currencies = await oracleClient.getCurrencies();
  return NolusAssetUtils.findTickersByGroup(currencies, "lease");
}
