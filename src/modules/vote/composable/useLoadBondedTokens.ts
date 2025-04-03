import { ref } from "vue";
import { Dec } from "@keplr-wallet/unit";
import { ChainConstants } from "@nolus/nolusjs";

import { AppUtils } from "@/common/utils";

export const useLoadBondedTokens = () => {
  const bondedTokens = ref<Dec>(new Dec(0));

  const loadBondedTokens = async () => {
    const node = await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);
    const res = await fetch(`${node.api}/cosmos/staking/v1beta1/pool`);
    const data = await res.json();
    bondedTokens.value = new Dec(data.pool.bonded_tokens);
  };

  return {
    loadBondedTokens,
    bondedTokens
  };
};
