<template>
  <router-view/>
</template>

<script lang="ts">

import { NolusClient } from '@/client/NolusClient'
import { ComponentPublicInstance } from 'vue'

export default {
  name: 'App',
  components: {},
  errorCaptured (
    err: unknown,
    instance: ComponentPublicInstance | null,
    info: string
  ) {
    console.log('errorCaptured: ', err)
  },
  mounted () {
    NolusClient.setInstance('https://net-dev.nolus.io:26612')
  },
  data () {
    return {}
  }
}
</script>

<style lang="sass">
</style>
