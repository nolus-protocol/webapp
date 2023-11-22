<template>
  <ReceiveComponent
    v-if="loaded"
    :networks="networks!"
  />
</template>

<script setup lang="ts">
import type { SquiRouterNetworkProp } from "@/types/NetworkConfig";
import ReceiveComponent from "@/components/ReceiveV2Components/ReceiveComponent.vue";
import { AppUtils } from "@/utils/AppUtils";
import { onMounted, ref } from "vue";

const networks = ref<SquiRouterNetworkProp[]>()
const loaded = ref(false);

onMounted(() => {
  onLoadSquidRouteConfig();
});

const onLoadSquidRouteConfig = async () => {
  const data = await AppUtils.getSquitRouteNetworks();
  const n = [];

  for(const key in data){
    n.push({ ...data[key], value: key });
  }

  networks.value = n;
  loaded.value = true;
}
</script>
