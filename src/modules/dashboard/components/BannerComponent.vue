<template>
  <div class="banner-box relative md:mb-[18px]">
    <button
      ref="leftButton"
      :class="{ opacity: hideLeft }"
      class="navigation left"
      @click="moveLeft"
    >
      <LeftArrow class="navigation-color" />
    </button>
    <button
      ref="rightButton"
      :class="{ opacity: hideRight }"
      class="navigation right"
      @click="moveRight"
    >
      <RightArrow class="navigation-color" />
    </button>
    <div
      ref="bannerContainer"
      class="banner-container"
    >
      <div
        v-for="(n, key) in news"
        :key="key"
        class="banner flex"
        @click="open(n)"
      >
        <div class="flex flex-col items-start">
          <p class="title flex items-center font-medium">
            <img :src="n['title-icon']" />
            {{ $t(`message.${n.title}`) }}
          </p>
          <p class="substitle font-semibold">
            {{ $t(`message.${n["subtitle"]}`) }}
          </p>
          <p class="description">
            {{ $t(`message.${n.description}`) }}
          </p>
        </div>
        <div class="image">
          <button
            class="close"
            @click="hideBanner($event, key as string)"
          >
            <Close
              :height="12"
              :width="12"
              class="close-color"
            />
          </button>
          <img :src="n.image" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import Close from "@/common/components/icons/Close.vue";
import LeftArrow from "@/common/components/icons/LeftArrow.vue";
import RightArrow from "@/common/components/icons/RightArrow.vue";

import type { New, News } from "../types";
import { AppUtils } from "@/common/utils";
import { inject, nextTick, onMounted, ref, watch } from "vue";
import { router } from "@/router";
import { useWalletStore } from "@/common/stores/wallet";

const news = ref<News>();
const bannerContainer = ref<HTMLElement>();
const leftButton = ref<HTMLElement>();
const rightButton = ref<HTMLElement>();
const transformX = ref(0);
const hideLeft = ref(true);
const hideRight = ref(true);
const openDialog = inject("openDialog", () => {});
const walletStore = useWalletStore();

let padding = 0;

onMounted(() => {
  loadNews();
});

watch(
  () => walletStore.wallet?.address,
  () => {
    loadNews();
  }
);

async function filterNewsVisibility(singleNew: New, key: string) {
  if (!singleNew.wallets && singleNew.wallets !== "") return { key, singleNew };

  const addresses = await AppUtils.getSingleNewAddresses(singleNew.wallets);
  if (addresses.length == 0) return { key: "", singleNew: {} as New };

  if (!addresses.includes(walletStore.wallet?.address as string)) return { key: "", singleNew: {} as New };

  return { key, singleNew };
}

async function fetchNewsWallets() {
  const news: News = await AppUtils.getNews();
  const newsPromises: Promise<{ key: string; singleNew: New }>[] = Object.keys(news).map((key) =>
    filterNewsVisibility(news[key], key)
  );

  return (await Promise.all(newsPromises)).reduce((acc, item) => {
    if (item.key) {
      acc[item.key] = item.singleNew;
    }
    return acc;
  }, {} as News);
}

async function loadNews() {
  news.value = await fetchNewsWallets();
  padding = (Object.keys(news.value).length - 1) * 24;
  nextTick(() => {
    checkVisibility();
  });
}

const hideBanner = (event: MouseEvent, key: string) => {
  event.preventDefault();
  event.stopPropagation();
  AppUtils.setBannerInvisible(key);
  const n: News = {};

  for (const k in news.value ?? {}) {
    if (k != key) {
      n[k] = news.value![k];
    }
  }
  news.value = n;
  nextTick(() => {
    moveDefault();
    checkVisibility();
  });
};

const checkVisibility = () => {
  hideLeft.value = hideLeftFunc();
  hideRight.value = hideRightFunc();

  if (hideLeft.value) {
    hideElement(leftButton.value!);
  } else {
    showElement(leftButton.value!);
  }

  if (hideRight.value) {
    hideElement(rightButton.value!);
  } else {
    showElement(rightButton.value!);
  }
};

function hideElement(element: HTMLElement) {
  setTimeout(() => {
    element.style.visibility = "hidden";
  }, 400);
}

function showElement(element: HTMLElement) {
  element.style.visibility = "visible";
}

function hideLeftFunc() {
  if (transformX.value == 0) {
    return true;
  }
  return false;
}

function hideRightFunc() {
  const c = (bannerContainer.value?.offsetWidth ?? 0) - (bannerContainer.value?.scrollWidth ?? 0);
  if (transformX.value == c || c == 0) {
    return true;
  }
  return false;
}

function moveLeft() {
  const box = bannerContainer.value!;
  const width = box.offsetWidth * 0.8;
  let value = transformX.value + width;

  if (value >= 0) {
    value = 0;
  }

  transformX.value = value;
  box.style.transform = `translateX(${transformX.value}px)`;
  checkVisibility();
}

function moveRight() {
  const box = bannerContainer.value!;
  const width = box.offsetWidth * 0.8;
  let value = transformX.value - width;
  const c = (bannerContainer.value?.offsetWidth ?? 0) - (bannerContainer.value?.scrollWidth ?? 0);

  if (c >= value) {
    value = c;
  }

  transformX.value = value;
  box.style.transform = `translateX(${transformX.value}px)`;
  checkVisibility();
}

function moveDefault() {
  const box = bannerContainer.value!;
  transformX.value = 0;
  box.style.transform = `translateX(${transformX.value}px)`;
}

async function open(n: New) {
  if (n.target.length > 0) {
    const e = n.target[0];
    if (e == "/") {
      await router.push(n.target);
      if (n.target.includes("#")) {
        openDialog();
      }
    } else {
      window.open(n.target, "_blank");
    }
  }
}
</script>
