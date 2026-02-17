import { ref } from "vue";
import { Dec } from "@keplr-wallet/unit";
import { BackendApi } from "@/common/api";

export const useLoadTallying = () => {
  const quorum = ref(new Dec(0));

  const loadTallying = async () => {
    const response = await BackendApi.getTallyingParams();
    quorum.value = new Dec(response.params.quorum);
  };

  return {
    loadTallying,
    quorum
  };
};
