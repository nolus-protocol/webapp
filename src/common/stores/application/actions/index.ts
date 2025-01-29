import { ApplicationActions } from "..";
import { loadCurrennncies } from "./loadCurrenncies";
import { changeNetwork } from "./changeNetwork";
import { setTheme } from "./setTheme";
import { loadTheme } from "./loadTheme";
import { loadAprRewards } from "./loadAprRewards";
import { setProtcolFilter } from "./setProtcolFilter";

export const actions = {
  [ApplicationActions.LOAD_CURRENCIES]: loadCurrennncies,
  [ApplicationActions.CHANGE_NETWORK]: changeNetwork,
  [ApplicationActions.SET_THEME]: setTheme,
  [ApplicationActions.LOAD_THEME]: loadTheme,
  [ApplicationActions.LOAD_APR_REWARDS]: loadAprRewards,
  setProtcolFilter: setProtcolFilter
};
