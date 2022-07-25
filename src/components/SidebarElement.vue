<template>
  <a
    :id="this.id"
    :class="[
      'sidebar-element cursor-pointer',
      this.$route.path == this.href ? 'active' : false,
    ]"
    :target="target || '_self'"
  >
    <span :class="['icon', `icon-${this.id}`]"></span>

    <span> {{ this.label }} </span>
  </a>
</template>
<script type="ts">
export default {
  name: 'SidebarElement',
  props: ['id', 'href', 'label', 'icon', 'iconHover', 'isActive', 'mobile', 'target']
}
</script>
<style scoped>
[class^="icon-"] {
}

[class^="icon-"]:before,
[class*=" icon-"]:before {
  font-family: "nolus";
  font-style: normal;
  font-weight: normal;
  speak: never;
  display: inline-block;
  text-decoration: inherit;
  width: unset;
  margin-right: 0;
  text-align: center;
  opacity: 1;
  font-variant: normal;
  text-transform: none;
  line-height: unset;
  margin-left: 0;
  font-size: 30px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* text-shadow: 1px 1px 1px rgb(127 127 127 / 30%); */
}
</style>
