<template>
  <div class="flex flex-col gap-4 border-b border-t border-border-color bg-neutral-bg-1 p-4">
    <div class="flex gap-4">
      <div class="h-20 w-20 rounded-lg bg-icon-link"></div>
      <div class="flex flex-1 flex-col text-typography-default">
        <span class="text-14 font-normal">Name</span>
        <span class="text-16 font-semibold">Apari</span>
      </div>
      <div class="flex flex-1 flex-col gap-1 text-typography-default">
        <span class="text-14 font-normal">Rarity</span>
        <Label
          variant="warning"
          value="Rare"
        />
      </div>
    </div>
    <span class="w-full border-b border-border-color" />
    <div class="flex gap-2">
      <div class="flex-1 flex-col gap-1 text-14 text-typography-default">
        <span class="font-semibold">Discounts:</span>
        <ul class="list-disc pl-4 text-14 font-normal">
          <li
            v-for="dc in discountsData"
            :key="dc"
          >
            {{ dc }}
          </li>
        </ul>
      </div>
      <div class="flex-1 flex-col gap-1 text-14 text-typography-default">
        <span class="font-semibold">Yield:</span>
        <ul class="list-disc pl-4 text-14 font-normal">
          <li
            v-for="dc in yieldData"
            :key="dc"
          >
            {{ dc }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Label } from "web-components";

const discountsData = ["3% lease long", "0.5% lease short"];
const yieldData = ["3% USDC", "2% stATOM", "0.5% BTC", "0.4% ETH", "2% AKT"];
</script>

<style scoped lang=""></style>
