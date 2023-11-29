<template>
  <div class="relative banner-box md:mb-[18px]">
    <button
      ref="leftButton"
      class="navigation left"
      :class="{ opacity: hideLeft }"
      @click="moveLeft"
    >
      <LeftArrow class="navigation-color" />
    </button>
    <button
      ref="rightButton"
      class="navigation right"
      :class="{ opacity: hideRight }"
      @click="moveRight"
    >
      <RightArrow class="navigation-color" />
    </button>
    <div
      class="banner-container"
      ref="bannerContainer"
    >
      <div
        v-for="(n, key) in  news "
        class="banner flex"
        :key="key"
      >
        <div class="flex flex-col	items-start">
          <p class="title flex nls-font-500">
            <img :src="n['title-icon']" />
            {{ $t(`message.${n.title}`) }} {{ key }}
          </p>
          <p class="nls-font-700 substitle">
            {{ $t(`message.${n["subtitle"]}`) }}
          </p>
          <p class="description">
            {{ $t(`message.${n.description}`) }}
          </p>
        </div>
        <div class="image">
          <button
            class="close"
            @click="hideBanner(key as string)"
          >
            <Close
              :width="12"
              :height="12"
              class="close-color"
            />
          </button>
          <img :src="n.image" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Close from '@/components/icons/Close.vue';
import LeftArrow from '@/components/icons/LeftArrow.vue';
import RightArrow from '@/components/icons/RightArrow.vue';

import type { News } from "@/types/News";
import { AppUtils } from "@/utils/AppUtils";
import { onMounted, ref, nextTick } from "vue";

const news = ref<News>();
const bannerContainer = ref<HTMLElement>();
const leftButton = ref<HTMLElement>();
const rightButton = ref<HTMLElement>();
const transformX = ref(0);
const hideLeft = ref(true);
const hideRight = ref(true);

let padding = 0;

onMounted(() => {
  loadNews();
});

const loadNews = async () => {
  news.value = await AppUtils.getNews();
  padding = (Object.keys(news.value).length - 1) * 24;
  nextTick(() => {
    checkVisibility();
  });
}
const hideBanner = (key: string) => {
  AppUtils.setBannerInvisible(key);
  const n: News = {};

  for (const k in (news.value ?? {})) {
    if (k != key) {
      n[k] = news.value![k];
    }
  }
  news.value = n;
  nextTick(() => {
    moveDefault();
    checkVisibility();
  });
}

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
}

const hideElement = (element: HTMLElement) => {
  setTimeout(() => {
    element.style.visibility = 'hidden';
  }, 400);
}

const showElement = (element: HTMLElement) => {
  element.style.visibility = 'visible';
}

const hideLeftFunc = () => {
  if (transformX.value == 0) {
    return true;
  }
  return false;

};

const hideRightFunc = () => {
  const c = (bannerContainer.value?.offsetWidth ?? 0) - (bannerContainer.value?.scrollWidth ?? 0)
  if (transformX.value == c || c == 0) {
    return true;
  }
  return false;
};

const moveLeft = () => {
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

const moveRight = () => {
  const box = bannerContainer.value!;
  const width = box.offsetWidth * 0.8;
  let value = transformX.value - width;
  const c = (bannerContainer.value?.offsetWidth ?? 0) - (bannerContainer.value?.scrollWidth ?? 0);

  if (c >= value) {
    value = c
  }

  transformX.value = value;
  box.style.transform = `translateX(${transformX.value}px)`;
  checkVisibility();
}

const moveDefault = () => {
  const box = bannerContainer.value!;
  transformX.value = 0;
  box.style.transform = `translateX(${transformX.value}px)`;
}
</script>