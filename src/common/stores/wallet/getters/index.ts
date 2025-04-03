import { available } from "./available";
import { currencies } from "./currencies";
import { history } from "./history";
import { vestTokens } from "./vestTokens";

export const getters = {
  available,
  vestTokens,
  currencies,
  historyItems: history
};
