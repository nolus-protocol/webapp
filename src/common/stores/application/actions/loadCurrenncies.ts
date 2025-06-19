import type { Store } from "../types";
import type { NetworkData } from "@nolus/nolusjs/build/types/Networks";
import type { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import type { Store as AdminStore } from "../../admin/types";

import { IGNORE_LEASE_ASSETS_STABLES, NATIVE_ASSET, NATIVE_NETWORK, NETWORK } from "@/config/global";
import { AssetUtils, EnvNetworkUtils, Logger } from "@/common/utils";
import { AssetUtils as NolusAssetUtils } from "@nolus/nolusjs/build/utils/AssetUtils";
import { ASSETS, CurrencyDemapping } from "@/config/currencies";
import { NolusClient } from "@nolus/nolusjs";
import { Lpp, Oracle } from "@nolus/nolusjs/build/contracts";
import { useAdminStore } from "../../admin";

export async function loadCurrennncies(this: Store) {
  try {
    const network = NETWORK;
    const [currenciesData, cosmWasmClient] = await Promise.all([
      network.currencies(),
      NolusClient.getInstance().getCosmWasmClient()
    ]);

    const data = await AssetUtils.parseNetworks(currenciesData as NetworkData);
    const native = NolusAssetUtils.getNativeAsset(currenciesData as NetworkData);

    const lease: { [key: string]: string[] } = {};
    const leasesCurrencies = new Set<string>();
    const lpnPromises = [];
    const leasePromises = [];

    const admin = useAdminStore();

    // console.log(JSON.stringify(data.networks));

    this.assetIcons = data.assetIcons;
    this.networks = data.networks;
    this.networksData = currenciesData as NetworkData;

    this.protocols = NolusAssetUtils.getProtocols(this.networksData!);
    this.lpn = [];

    const nativeCurrency = currenciesData.networks.list[NATIVE_NETWORK.key].currencies[native].native!;

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
      coingeckoId: ASSETS[NATIVE_ASSET.ticker as keyof typeof ASSETS].coinGeckoId
    };
    for (const protocol of this.protocols) {
      lease[protocol] = [];
      lpnPromises.push(
        getLpn(cosmWasmClient, protocol, admin).then((lpn) => {
          return data.networks[NATIVE_NETWORK.key][`${lpn}@${protocol}`];
        })
      );
      leasePromises.push(
        getLease(cosmWasmClient, protocol, admin).then((leases) => {
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
    this.currenciesData = data.networks[NATIVE_NETWORK.key];
    this.leasesCurrencies = Array.from(leasesCurrencies).filter((item) => !IGNORE_LEASE_ASSETS_STABLES.includes(item));
  } catch (e) {
    Logger.error(e);
  }
}

async function getLpn(client: CosmWasmClient, protocol: string, admin: AdminStore) {
  const lppClient = new Lpp(client, admin.protocols[EnvNetworkUtils.getStoredNetworkName()]![protocol].lpp);
  return lppClient.getLPN();
}

async function getLease(client: CosmWasmClient, protocol: string, admin: AdminStore) {
  const oracleClient = new Oracle(client, admin.protocols[EnvNetworkUtils.getStoredNetworkName()]![protocol].oracle);
  const currencies = await oracleClient.getCurrencies();

  return NolusAssetUtils.findTickersByGroup(currencies, "lease");
}
