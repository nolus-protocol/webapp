<template>
  <div
    class="outline text-center background w-full max-w-[516px] rounded-[12px] mx-auto shadow-modal modal-send-receive mt-[52px]"
    :class="{
      'pt-[15px]': !showHeader 
    }"
    @click.stop
  >
    <div v-if="showHeader" class="flex modal-send-receive-header">
      <button
        v-if="isTabLayout"
        v-for="(tab, index) of headerList"
        :key="`${tab}-${index}`"
        v-text="tab"
        :class="index + 1 === activeTab ? 'active' : ''"
        @click="switchTab(index + 1)"
      >
      </button>
      <div v-else class="navigation-header">
        <h1 class="block w-full nls-font-700 text-28 md:text-32 text-primary text-center">
          {{ headerList[0] }}
        </h1>
      </div>
    </div>

    <template v-if="isTabLayout" v-for="(tab, index) in headerList">
      <slot
        :key="index"
        v-if="index + 1 === activeTab"
        :name="`tab-${index + 1}`"
      >
      </slot>
    </template>
    <slot v-else></slot>
  </div>
</template>

<script lang="ts" setup>
import { ref, provide, computed, type PropType } from 'vue';
import router from '@/router';

const activeTab = ref(1);
const showHeader = ref(true);

const { headerList, routes } = defineProps({
  headerList: {
    type: Array as PropType<string[]>,
    required: true,
  },
  routes: {
    type: Array as PropType<string[]>,
    default: [],
  },
});

const isTabLayout = computed(() => {
  return headerList.length > 1;
});

function switchTab(index: number) {
  activeTab.value = index;
  const route = routes[index-1] ;
  if(route != null){
    setRoute(route);
  }
}

function setRoute(route: string){
  const path = router.currentRoute.value.path;
  router.replace({
    path,
    hash: `#${route}`
  })
}

function setShowDialogHeader(shouldShow: boolean) {
  showHeader.value = shouldShow;
}

provide('setShowDialogHeader', setShowDialogHeader);
</script>
