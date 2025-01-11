<template>
  <div>
    <Label
      :value="value"
      :variant="variant"
      class="mr-1"
    />
    <Tooltip
      position="top"
      :content="tooltip"
    >
      <SvgIcon
        name="help"
        class="rounded-full"
        size="s"
      />
    </Tooltip>
  </div>
</template>

<script lang="ts" setup>
defineProps<{ value: string; variant: LabelVariant; tooltip: string }>();
import { Label, Tooltip, SvgIcon, type LabelVariant } from "web-components";
</script>
