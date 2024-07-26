<template>
  <div
    :class="{
      'pt-[15px]': !showHeader,
      'px-4 py-6 lg:p-10': !isTabLayout
    }"
    class="mx-auto mt-[62px] flex w-full max-w-[516px] flex-col rounded-xl bg-neutral-bg-50 text-center"
    @click.stop
  >
    <div
      v-if="showHeader"
      class="flex justify-center"
    >
      <template v-if="isTabLayout">
        <div class="flex w-full">
          <button
            v-for="(tab, index) of headerList"
            :key="`${tab}-${index}`"
            :class="[
              {
                'bg-hover-btn text-neutral-typography-50': index + 1 !== activeTab,
                active: index + 1 === activeTab
              }
            ]"
            class="flex-1 py-6 text-center text-28 font-semibold text-neutral-typography-200 first:rounded-tl-xl last:rounded-tr-xl md:text-32"
            @click="switchTab(index + 1)"
            v-text="tab"
          ></button>
        </div>
      </template>
      <template v-else>
        <div class="mb-6 flex w-full border-b-[1px] border-border-color pb-5">
          <button
            v-if="back"
            class=""
            type="button"
            @click="backClick"
          >
            <ArrowLeftIcon
              aria-hidden="true"
              class="h-6 w-6 text-neutral-typography-200"
            />
          </button>
          <h1
            class="block w-full text-center text-28 font-semibold leading-7 text-neutral-typography-200 md:text-32 md:leading-8"
          >
            {{ headerList[0] }}
          </h1>
        </div>
      </template>
    </div>

    <template v-if="isTabLayout">
      <template v-for="(tab, index) in headerList">
        <slot
          v-if="index + 1 === activeTab"
          :key="index"
          :name="`tab-${index + 1}`"
        >
        </slot>
      </template>
    </template>
    <slot v-else></slot>
  </div>
</template>

<script lang="ts" setup>
import { computed, type PropType, provide, ref } from "vue";
import { router } from "@/router";
import { ArrowLeftIcon } from "@heroicons/vue/24/solid";

const props = defineProps({
  headerList: {
    type: Array as PropType<string[]>,
    required: true
  },
  activeTab: {
    type: Number,
    default: 1
  },
  disabled: {
    type: Array<Number>,
    default: []
  },
  back: {
    type: Function,
    required: false
  },
  routes: {
    type: Array as PropType<string[]>,
    default: () => {
      return [];
    }
  }
});

const activeTab = ref(props.activeTab);
const showHeader = ref(true);

const backClick = () => {
  if (props.back) {
    props.back();
  }
};

const isTabLayout = computed(() => {
  return props.headerList.length > 1;
});

function switchTab(index: number) {
  if (props.disabled.includes(index)) {
    return false;
  }
  activeTab.value = index;
  const route = props.routes[index - 1];
  if (route != null) {
    setRoute(route);
  }
}

function setRoute(route: string) {
  const path = router.currentRoute.value.path;
  router.replace({
    path,
    hash: `#${route}`
  });
}

function setShowDialogHeader(shouldShow: boolean) {
  showHeader.value = shouldShow;
}

provide("setShowDialogHeader", setShowDialogHeader);
</script>
