<template>
  <!--  <nav>-->
  <!--    <router-link to="/">Home</router-link> |-->
  <!--    <router-link to="/welcome">Welcome</router-link> |-->
  <!--  </nav>-->
  <router-view/>
</template>

<script lang="ts">

import { NolusClient } from '@/client/NolusClient'

export default {
  name: 'App',
  components: {},
  errorCaptured (err: unknown) {
    console.log('errorCaptured: ', err)
  },
  mounted () {
    console.log('App component is mounted!')
  },
  created () {
    NolusClient.setInstance('https://net-dev.nolus.io:26612')
    console.log('App is created!')
  },
  data () {
    return {}
  }
}
</script>

<style lang="sass">
</style>
