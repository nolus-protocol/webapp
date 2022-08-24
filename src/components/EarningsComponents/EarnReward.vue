<template>
<div class="block">
  <div
    :class="[
      'grid gap-6 border-b border-t border-standart px-6 py-3  items-center justify-between',
      cols
        ? 'grid-cols-' + cols
        : 'grid-cols-3 md:grid-cols-4',
    ]"
  >
    <!-- Ticker -->
    <div class="inline-flex items-center">
      <img
        :src="require('@/assets/icons/coins/btc.svg')"
        class="inline-block m-0 mr-4"
        height="32"
        width="32"
      />
      <div class="inline-block">
        <p
          class="text-primary nls-font-500 text-18 text-left uppercase m-0"
        >
          {{ asset }}
        </p>
        <p
          class="text-dark-grey text-12 nls-font-400 text-left capitalize m-0"
        >
          {{ reward }}
        </p>
      </div>
    </div>

    <!-- Balance -->
    <div class="flex justify-end">
      <button
        :class="`btn btn-secondary btn-medium-secondary ${loading ? 'js-loading' : 'btn-emphatized'}`"
        data-v-37958d79=""
      >
        Claim
      </button>
    </div>
  </div>
</div>
</template>

<script lang="ts" setup>
defineProps({
  cols: {
    type: Number,
  },
  icon: {
    type: String,
    required: true,
  },
  asset: {
    type: String,
    required: true,
  },
  reward: {
    type: String,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})
</script>
