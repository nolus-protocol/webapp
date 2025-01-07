import { ref } from "vue";
import { ChainConstants } from "@nolus/nolusjs";
import { Dec } from "@keplr-wallet/unit";

import { AppUtils } from "@/common/utils";

export const useLoadTallying = () => {
  const quorum = ref(new Dec(0));

  const loadTallying = async () => {
    const node = await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);

    const res = await fetch(`${node.api}/cosmos/gov/v1/params/tallying`);
    const data = await res.json();

    quorum.value = new Dec(data.params.quorum);
  };

  return {
    loadTallying,
    quorum
  };
};
