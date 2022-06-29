<template>
  <a :href="(this.link !== 'undefined' && this.link !== null ? this.link : '')" class="logo-float p-4 lg:p-8">
    <img
      class="inline-block lg:block"
      src="@/assets/icons/logo.svg"
    />
  </a>
</template>
<script lang="ts">
export default {
  name: 'LogoLink',
  props: {
    link: {
      type: String,
      required: true
    }
  }
}
</script>
