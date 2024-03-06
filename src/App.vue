<template>
  <RouterView />
</template>

<script lang="ts" setup>
import { RouterView } from "vue-router";
import { watch } from "vue";

import { useApplicationStore } from "@/common/stores/application";
import { APPEARANCE } from "./config/global";

const application = useApplicationStore();

watch(
  () => application.theme,
  () => {
    if (application.theme) {
      const themes = Object.keys(APPEARANCE);
      document.body.classList.forEach((item) => {
        if (themes.includes(item)) {
          document.body.classList.remove(item);
        }
      });
      document.documentElement.classList.forEach((item) => {
        if (themes.includes(item)) {
          document.documentElement.classList.remove(item);
        }
      });
      document.body.classList.add(application.theme);
      document.documentElement.classList.add(application.theme);
    }
  }
);
</script>
