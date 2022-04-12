<template>
  <a
    :id="this.id"
    :href="this.href"
    :class="[
      'sidebar-element',
      (typeof this.isActive !== 'undefined' && this.isActive === true ? 'active' : '')
    ]"
  >
    <img
      class="icon"
      :src="this.icon"
    />
    <img
      class="iconHover"
      :src="this.iconHover"
    />
    <span>
        {{ this.label }}
    </span>
  </a>
</template>
<script type="ts">
export default {
  name: 'SidebarElement',
  props: ['id', 'href', 'label', 'icon', 'iconHover', 'isActive']
}
</script>
