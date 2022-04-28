<template>
  <a
    :id="this.id"
    :href="this.href"
    :class="[
      'sidebar-link-element',
    ]"
  >
    <span>
        {{ this.label }}
    </span>
  </a>
</template>
<script type="ts">
export default {
  name: 'SidebarLinkElement',
  props: ['id', 'href', 'label']
}
</script>
