import { onMounted, onUnmounted, ref } from "vue";
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
    } catch (error: unknown) {
      Logger.error(error);
    }
  }

  async function setVersion() {
    try {
      const nodeInfo = await BackendApi.getNodeInfo();
      version.value = nodeInfo.version;
    } catch (error: unknown) {
      Logger.error(error);
    }
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    setBlock();
    setVersion();
    intervalId = setInterval(setBlock, UPDATE_BLOCK_INTERVAL);
  });

  onUnmounted(() => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  });

  return { block, version };
}
