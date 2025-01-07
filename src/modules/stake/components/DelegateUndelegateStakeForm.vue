<template>
  <template v-if="type == StakeDialog.DELEGATE">
    <DelegateForm />
  </template>

  <template v-if="type == StakeDialog.UNDELEGATE">
    <UndelegateForm />
  </template>
</template>

<script lang="ts" setup>
import { StakeDialog } from "@/modules/stake/enums";
import DelegateForm from "./DelegateForm.vue";
import UndelegateForm from "./UndelegateForm.vue";

defineProps<{
  type: StakeDialog.DELEGATE | StakeDialog.UNDELEGATE;
}>();
</script>
