<template>
  <a
    :href="this.link !== 'undefined' && this.link !== null ? this.link : ''"
    class="md-nls-pl-25 logo-float p-4 lg:p-8"
  >
    <img src="@/assets/icons/logo.svg" class="inline-block lg:block" />
  </a>
</template>
<script lang="ts">
export default {
  name: "LogoLink",
  props: {
    link: {
      type: String,
      required: true,
    },
  },
};
</script>
