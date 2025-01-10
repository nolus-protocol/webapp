<template>
  <div class="flex flex-col gap-8">
    <ListHeader :title="$t('message.assets')">
      <div class="flex gap-2">
        <Button
          :label="$t('message.swap')"
          severity="secondary"
          size="large"
          @click="() => router.push(`/${RouteNames.ASSETS}/${AssetsDialog.SWAP}`)"
        />
        <Button
          :label="$t('message.receive')"
          severity="secondary"
          size="large"
          @click="() => router.push(`/${RouteNames.ASSETS}/${AssetsDialog.RECEIVE}`)"
        />
        <Button
          :label="$t('message.send')"
          severity="secondary"
          size="large"
          @click="() => router.push(`/${RouteNames.ASSETS}/${AssetsDialog.SEND}`)"
        />
      </div>
    </ListHeader>
    <Widget class="overflow-x-auto md:overflow-auto">
      <AssetsTable />
    </Widget>
    <router-view></router-view>
  </div>
</template>

<script lang="ts" setup>
import { Button, Widget } from "web-components";
import { RouteNames } from "@/router";

import ListHeader from "@/common/components/ListHeader.vue";
import { AssetsTable } from "./components";
import { AssetsDialog } from "@/modules/assets/enums";
import { useRouter } from "vue-router";

const router = useRouter();
</script>
