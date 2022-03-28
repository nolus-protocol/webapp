<template>
    <a :href="(typeof this.href !== 'undefined' && this.href !== null ? this.href : '')" class="logo-float p-8">
      <img
        src="@/assets/icons/logo.svg"
      />
    </a>
</template>
<script type="ts">
export default {
  name: 'LogoLink',
  props: ['href', 'classes']
}
</script>
