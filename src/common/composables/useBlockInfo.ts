import { onMounted, ref } from "vue";
import { NolusClient } from "@nolus/nolusjs";
import { Logger } from "@/common/utils";
import { UPDATE_BLOCK_INTERVAL } from "@/config/global";
import { BackendApi } from "@/common/api";

export function useBlockInfo() {
  const block = ref(0);
  const version = ref("");

  async function setBlock() {
    try {
      const nolusClient = NolusClient.getInstance();
      block.value = await nolusClient.getBlockHeight();
    } catch (error: Error | any) {
      Logger.error(error);
    }
  }

  async function setVersion() {
    try {
      const nodeInfo = await BackendApi.getNodeInfo();
      version.value = nodeInfo.version;
    } catch (error: Error | any) {
      Logger.error(error);
    }
  }

  onMounted(() => {
    setBlock();
    setVersion();
    setInterval(setBlock, UPDATE_BLOCK_INTERVAL);
  });

  return { block, version };
}
