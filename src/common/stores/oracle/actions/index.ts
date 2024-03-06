import { OracleActions } from "..";
import { getPrices } from "./getPrices";

export const actions = {
  [OracleActions.GET_PRICES]: getPrices
};
