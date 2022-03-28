<template>
  <a :href="(this.link !== 'undefined' && this.link !== null ? this.link : '')" class="logo-float p-8">
    <img
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
