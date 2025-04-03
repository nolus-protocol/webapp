<template>
  <Button
    size="small"
    :label="isMobile() ? '' : $t('message.connect-wallet')"
    severity="primary"
    icon="wallet-add"
    icon-position="left"
    @click="() => dialog?.show()"
  />
  <Dialog
    ref="dialog"
    show-close
    :title="$t('message.select-wallet')"
    class-list="md:h-auto"
  >
    <template v-slot:content>
      <AuthComponent />
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref } from "vue";
import { Button, Dialog } from "web-components";
import { isMobile } from "@/common/utils";
import AuthComponent from "@/common/components/auth/AuthComponent.vue";

const dialog = ref();

onBeforeUnmount(() => {
  dialog?.value?.close();
});
</script>
