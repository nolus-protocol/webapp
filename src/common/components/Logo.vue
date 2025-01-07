<template>
  <RouterLink
    id="logo"
    to="/"
  >
  </RouterLink>
</template>

<script lang="ts" setup></script>

<style scoped lang="scss">
html {
  #logo {
    background-image: url("@/assets/icons/logo-light.svg");
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    width: 125px;
    height: 32px;
  }

  &.dark {
    #logo {
      background-image: url("@/assets/icons/logo-dark.svg");
    }
  }
  &.sync {
    #logo {
      @media (prefers-color-scheme: dark) {
        background-image: url("@/assets/icons/logo-dark.svg");
      }
    }
  }
}
</style>
