<template>
  <DialogHeader :headerList="[$t('message.connect-wallet')]">
    <div class="overflow-auto md:max-h-[70vh] text-primary p-10 custom-scroll">
      <AuthComponent />
    </div>
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from "@/components/modals/templates/DialogHeader.vue";
import AuthComponent from "@/components/AuthComponents/AuthComponent.vue";

</script>