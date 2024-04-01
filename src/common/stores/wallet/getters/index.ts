import { available } from "./available";
import { getCurrencyByTicker } from "./getCurrencyByTicker";
import { getCurrencyInfo } from "./getCurrencyInfo";
import { getIbcDenomBySymbol } from "./getIbcDenomBySymbol";
import { vestTokens } from "./vestTokens";

export const getters = {
  available,
  getCurrencyByTicker,
  getCurrencyInfo,
  getIbcDenomBySymbol,
  vestTokens
};
