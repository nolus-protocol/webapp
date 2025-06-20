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

export const CurrencyMappingEarn: {
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
  },
  ALL_SOL: {
    ticker: "SOL"
  },
  ALL_BTC: {
    ticker: "BTC"
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
  },
  SOL: {
    ticker: "ALL_SOL"
  },
  BTC: {
    ticker: "ALL_BTC"
  }
};

export enum SOURCE_PORTS {
  TRANSFER = "transfer"
}
