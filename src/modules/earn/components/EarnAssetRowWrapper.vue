<template>
  <EarningAssetsTableRow
    v-for="(row, index) in assetsData"
    :id="row.id"
    :key="index"
    :items="row.items"
    @button-click="
      (data) => {
        console.info(data);
      }
    "
  />
</template>

<script lang="ts" setup>
import { EarningAssetsTableRow } from "web-components";
</script>

<style lang="scss" scoped></style>
