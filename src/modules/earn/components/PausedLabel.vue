<template>
  <div>
    <Label
      :value="value"
      :variant="variant"
      class="mr-1"
    />
  </div>
</template>

<script lang="ts" setup>
defineProps<{ value: string; variant: LabelVariant }>();
import { Label, type LabelVariant } from "web-components";
</script>
