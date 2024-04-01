export const ASSETS = {
  NLS: {
    coinGeckoId: "nolus"
  },
  USDC: {
    coinGeckoId: "usd-coin"
  },
  USDC_AXELAR: {
    coinGeckoId: "usd-coin"
  },
  ATOM: {
    coinGeckoId: "cosmos"
  },
  OSMO: {
    coinGeckoId: "osmosis"
  },
  ST_OSMO: {
    coinGeckoId: "stride-staked-osmo"
  },
  ST_ATOM: {
    coinGeckoId: "stride-staked-atom"
  },
  WETH: {
    coinGeckoId: "weth"
  },
  WBTC: {
    coinGeckoId: "wrapped-bitcoin"
  },
  AKT: {
    coinGeckoId: "akash-network"
  },
  JUNO: {
    coinGeckoId: "juno-network"
  },
  AXL: {
    coinGeckoId: "axelar"
  },
  EVMOS: {
    coinGeckoId: "evmos"
  },
  STK_ATOM: {
    coinGeckoId: "stkatom"
  },
  SCRT: {
    coinGeckoId: "secret"
  },
  CRO: {
    coinGeckoId: "crypto-com-chain"
  },
  TIA: {
    coinGeckoId: "celestia"
  },
  STARS: {
    coinGeckoId: "stargaze"
  },
  Q_ATOM: {
    coinGeckoId: "qatom"
  },
  NTRN: {
    coinGeckoId: "neutron-3"
  },
  DYDX: {
    coinGeckoId: "dydx-chain"
  },
  STRD: {
    coinGeckoId: "stride"
  },
  MILK_TIA: {
    coinGeckoId: "milkyway-staked-tia"
  },
  ST_TIA: {
    coinGeckoId: "stride-staked-tia"
  },
  DYM: {
    coinGeckoId: "dymension"
  },
  JKL: {
    coinGeckoId: "jackal-protocol"
  },
  INJ: {
    coinGeckoId: "injective-protocol"
  },
  LVN: {
    coinGeckoId: "levana-protocol"
  },
  PICA: {
    coinGeckoId: "picasso"
  },
  USDC_NOBLE: {
    coinGeckoId: "usd-coin"
  }
};

export const CurrencyMapping: {
  [key: string]: {
    ticker: string;
    name?: string;
  };
} = {
  WETH_AXELAR: {
    ticker: "WETH"
  },
  USDC_AXELAR: {
    ticker: "USDC",
    name: "USDC.axl"
  },
  WBTC_AXELAR: {
    ticker: "WBTC"
  }
};

export const CurrencyDemapping: {
  [key: string]: {
    ticker: string;
    name?: string;
  };
} = {
  WETH: {
    ticker: "WETH_AXELAR"
  },
  USDC: {
    ticker: "USDC_AXELAR",
    name: "USDC.axl"
  },
  WBTC: {
    ticker: "WBTC_AXELAR"
  }
};

export enum SOURCE_PORTS {
  TRANSFER = "transfer"
}
