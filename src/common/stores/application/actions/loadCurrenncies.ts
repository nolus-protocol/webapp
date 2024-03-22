import type { Store } from "../types";
import type { NetworkData } from "@nolus/nolusjs/build/types/Networks";
import { NATIVE_ASSET, NATIVE_NETWORK, NETWORKS } from "@/config/global";
import { AssetUtils, EnvNetworkUtils, Logger } from "@/common/utils";
import { AssetUtils as NolusAssetUtils } from "@nolus/nolusjs/build/utils/AssetUtils";
import { ASSETS } from "@/config/currencies";

export async function loadCurrennncies(this: Store) {
  try {
    const network = NETWORKS[EnvNetworkUtils.getStoredNetworkName()];
    const currenciesData = (await network.currencies()) as NetworkData;
    const data = AssetUtils.parseNetworks(currenciesData);
    const lease: { [key: string]: string[] } = {};
    const leasesCurrencies = new Set<string>();

    this.assetIcons = data.assetIcons;
    this.networks = data.networks;
    this.networksData = currenciesData;

    const native = NolusAssetUtils.getNativeAsset(currenciesData);
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
      const lpn = NolusAssetUtils.getLpn(currenciesData, protocol);
      this.lpn.push(data.networks[NATIVE_NETWORK.key][`${lpn}@${protocol}`]);
    }

    this.currenciesData = data.networks[NATIVE_NETWORK.key];

    for (const protocol of this.protocols) {
      lease[protocol] = [];
      for (const l of NolusAssetUtils.getLease(currenciesData, protocol as string)) {
        lease[protocol].push(l);
        leasesCurrencies.add(l);
      }
    }

    this.lease = lease;
    this.leasesCurrencies = Array.from(leasesCurrencies);
  } catch (e) {
    Logger.error(e);
  }
}
