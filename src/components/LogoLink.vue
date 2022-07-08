<template>
  <a
    :href="this.link !== 'undefined' && this.link !== null ? this.link : ''"
    class="md-nls-pl-25 logo-float p-4 nls-pl-sm-0 nls-ml-sm-16 lg:p-8"
  >
    <img class="inline-block lg:block" src="@/assets/icons/logo.svg" />
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
