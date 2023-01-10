import nlsIcon from "@/assets/icons/coins/nls.svg";
import usdcIcon from "@/assets/icons/coins/usdc.svg";
import atomIcon from "@/assets/icons/coins/atom.svg";
import osmosisIcon from "@/assets/icons/coins/osmosis.svg";
import wethIcon from "@/assets/icons/coins/eth.svg";
import wbtcIcon from "@/assets/icons/coins/btc.svg";
import evmosIcon from "@/assets/icons/coins/evmos.svg";
import junoIcon from "@/assets/icons/coins/juno.svg";
import starsIcon from "@/assets/icons/coins/stars.svg";
import croIcon from "@/assets/icons/coins/cro.svg";
import scrtIcon from "@/assets/icons/coins/scrt.svg";

import { ChainConstants } from "@nolus/nolusjs";

export const ASSETS = {
  NLS: {
    key: "NLS",
    abbreviation: "NLS",
    coinGeckoId: ChainConstants.COIN_GECKO_ID,
    coinIcon: nlsIcon,
    defaultPrice: "0"
  },
  USDC: {
    key: "USDC",
    abbreviation: "USDC",
    coinGeckoId: "usd-coin",
    coinIcon: usdcIcon,
    defaultPrice: "0"
  },
  ATOM: {
    key: "ATOM",
    abbreviation: "ATOM",
    coinGeckoId: "cosmos",
    coinIcon: atomIcon,
    defaultPrice: "0"
  },
  OSMO: {
    key: "OSMO",
    abbreviation: "OSMO",
    coinGeckoId: "osmosis",
    coinIcon: osmosisIcon,
    defaultPrice: "0"
  },
  WETH: {
    key: "WETH",
    abbreviation: "WETH",
    coinGeckoId: "weth",
    coinIcon: wethIcon,
    defaultPrice: "0"
  },
  WBTC: {
    key: "WBTC",
    abbreviation: "WBTC",
    coinGeckoId: "wrapped-bitcoin",
    coinIcon: wbtcIcon,
    defaultPrice: "0"
  },
  EVMOS: {
    key: "EVMOS",
    abbreviation: "EVMOS",
    coinGeckoId: "evmos",
    coinIcon: evmosIcon,
    defaultPrice: "0"
  },
  JUNO: {
    key: "JUNO",
    abbreviation: "JUNO",
    coinGeckoId: "juno-network",
    coinIcon: junoIcon,
    defaultPrice: "0"
  },
  STARS: {
    key: "STARS",
    abbreviation: "STARS",
    coinGeckoId: "stargaze",
    coinIcon: starsIcon,
    defaultPrice: "0"
  },
  CRO: {
    key: "CRO",
    abbreviation: "CRO",
    coinGeckoId: "crypto-com-chain",
    coinIcon: croIcon,
    defaultPrice: "0"
  },
  SCRT: {
    key: "SCRT",
    abbreviation: "SCRT",
    coinGeckoId: "secret",
    coinIcon: scrtIcon,
    defaultPrice: "0"
  }
}

export const LPN_CURRENCY = ASSETS.USDC;
export const NATIVE_CURRENCY = ASSETS.NLS;