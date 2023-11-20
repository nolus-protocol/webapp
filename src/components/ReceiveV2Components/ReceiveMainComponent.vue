<template>
  <ReceiveComponent
    v-if="loaded"
    :networks="networks!"
  />
</template>

<script setup lang="ts">
import type { SquiRouterNetworkProp } from "@/types/NetworkConfig";
import ReceiveComponent from "@/components/ReceiveV2Components/ReceiveComponent.vue";
import { ApptUtils } from "@/utils/AppUtils";
import { onMounted, ref } from "vue";

const networks = ref<SquiRouterNetworkProp[]>()
const loaded = ref(false);

onMounted(() => {
  onLoadSquidRouteConfig();
});

const onLoadSquidRouteConfig = async () => {
  const data = await ApptUtils.getSquitRouteNetworks();
  networks.value = data.map((item) => {
    return { ...item, value: item.key };
  });
  loaded.value = true;
}
</script>
