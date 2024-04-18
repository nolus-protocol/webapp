<template>
  <div class="flex flex-row flex-wrap gap-y-8 lg:gap-x-5">
    <div
      v-for="index in 5"
      :key="index"
      :class="index > 1 ? ['background lg:w-[calc(50%-10px)]'] : ['background']"
      class="bg-neutral-bg-50 dark:border-border-color flex w-full flex-col overflow-clip rounded-xl shadow-lg dark:border-[1px]"
    >
      <!-- Mimic the title and status -->
      <div class="mb-5 flex items-start justify-between p-5 pb-0">
        <div
          class="basis-4/5 overflow-hidden break-words text-xl font-medium tracking-tight text-neutral-900 dark:text-white md:text-2xl"
        >
          <div
            class="skeleton-box"
            style="width: 70%; height: 1em"
          ></div>
        </div>
        <div
          class="skeleton-box flex items-center gap-2 rounded-md px-3 py-1"
          style="width: 120px; height: 1.5em"
        ></div>
      </div>

      <!-- Mimic the voting period details -->
      <div
        v-if="index === 1"
        class="mb-5 flex flex-col gap-y-4 border-b border-t px-5 py-4"
      >
        <div class="flex flex-col items-center justify-between gap-2 dark:text-white md:flex-row md:gap-0">
          <div class="flex gap-4">
            <div>
              <span class="block text-sm">Turnout:</span>
              <span class="text-base font-medium"
                ><div
                  class="skeleton-box"
                  style="width: 50px; height: 1em"
                ></div
              ></span>
            </div>
            <div>
              <span class="block text-sm">Quorum:</span>
              <span class="text-base font-medium"
                ><div
                  class="skeleton-box"
                  style="width: 50px; height: 1em"
                ></div
              ></span>
            </div>
            <div>
              <span class="block text-sm">Voting ends:</span>
              <span class="text-base font-medium"
                ><div
                  class="skeleton-box"
                  style="width: 70px; height: 1em"
                ></div
              ></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Mimic the summary -->
      <div class="flex-1 px-5 text-neutral-900 dark:text-white">
        <div
          class="prose prose-h1:mb-2 prose-h1:text-lg prose-h1:font-medium prose-h2:my-1 prose-h2:text-lg prose-h2:font-medium"
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

      <!-- Mimic the buttons -->
      <div class="mt-5">
        <button
          v-if="index > 1 && index % 2 == 0"
          class="flex w-full items-center justify-center bg-neutral-50 p-3 text-sm font-medium transition-colors hover:bg-neutral-100 hover:text-neutral-800"
          style="height: 1em"
        ></button>
        <button
          v-if="index === 1"
          class="bg-primary-50 hover:bg-primary-100 active:bg-primary-200 flex w-full items-center justify-center p-3 text-sm font-medium text-white"
          style="height: 1em"
        ></button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
// No script needed for a skeleton component
</script>

<style lang="scss" scoped>
.skeleton-box {
  background-color: #ccc;
  animation: blink 1.2s linear infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
