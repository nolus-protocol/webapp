<template>
  <div class="flex flex-col flex-wrap justify-between gap-y-8 md:flex-row">
    <Widget
      class="h-fit flex-[0_calc(100%/2-16px)] !gap-0 !p-0"
      v-for="index in 5"
      :key="index"
    >
      <div class="flex flex-col gap-y-6 p-6 pb-4">
        <div class="flex flex-col gap-y-3">
          <div class="text-20 font-semibold text-neutral-bg-inverted-1">
            <div
              class="skeleton-box"
              style="width: 70%; height: 1em"
            ></div>
          </div>
          <div
            class="skeleton-box"
            style="width: 20%; height: 1em"
          ></div>
        </div>
        <hr class="border-border-color" />
        <div
          v-if="index === 1"
          class="flex flex-col gap-y-3"
        >
          <div class="flex gap-3">
            <div>
              <span class="mb-1 block text-14">
                <div
                  class="skeleton-box"
                  style="width: 100px; height: 1em"
                ></div>
              </span>
              <span class="text-16 font-semibold text-typography-default"
                ><div
                  class="skeleton-box"
                  style="width: 70px; height: 1em"
                ></div
              ></span>
            </div>
            <div>
              <span class="mb-1 block text-14">
                <div
                  class="skeleton-box"
                  style="width: 100px; height: 1em"
                ></div>
              </span>
              <span class="text-16 font-semibold text-typography-default"
                ><div
                  class="skeleton-box"
                  style="width: 70px; height: 1em"
                ></div
              ></span>
            </div>
            <div>
              <span class="mb-1 block text-14">
                <div
                  class="skeleton-box"
                  style="width: 100px; height: 1em"
                ></div
              ></span>
              <span class="text-16 font-semibold text-typography-default"
                ><div
                  class="skeleton-box"
                  style="width: 70px; height: 1em"
                ></div
              ></span>
            </div>
          </div>
        </div>
        <div
          class="prose prose-h1:mb-2 prose-h1:text-lg prose-h1:font-medium prose-h2:my-1 prose-h2:text-lg prose-h2:font-medium text-16 font-normal"
        >
          <div
            class="skeleton-box"
            style="width: 100%; height: 1em"
          ></div>
          <div
            class="skeleton-box"
            style="width: 80%; height: 1em"
          ></div>
          <div
            class="skeleton-box"
            style="width: 90%; height: 1em"
          ></div>
        </div>
      </div>
      <div class="flex justify-center rounded-b-xl border-t border-border-color bg-neutral-bg-1 p-3">
        <div
          class="skeleton-box"
          style="width: 100%; height: 1em"
        ></div>
        <div
          class="skeleton-box"
          style="width: 100%; height: 1em"
        ></div>
      </div>
    </Widget>
  </div>
</template>

<script lang="ts" setup>
import { Widget } from "web-components";
</script>

<style lang="scss" scoped></style>
