import { ref } from "vue";
import { Dec } from "@keplr-wallet/unit";
import { BackendApi } from "@/common/api";

export const useLoadBondedTokens = () => {
  const bondedTokens = ref<Dec>(new Dec(0));

  const loadBondedTokens = async () => {
    const response = await BackendApi.getStakingPool();
    bondedTokens.value = new Dec(response.pool.bonded_tokens);
  };

  return {
    loadBondedTokens,
    bondedTokens
  };
};
