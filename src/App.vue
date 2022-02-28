<template>
<!--  <nav>-->
<!--    <router-link to="/">Home</router-link> |-->
<!--    <router-link to="/welcome">Welcome</router-link> |-->
<!--  </nav>-->
  <router-view/>
</template>

<script lang="ts">

export default {
  name: 'App',
  components: {

  },
  mounted () {
    console.log('App component is mounted!')
  },
  created () {
    console.log('App is created!')
  },
  data () {
    return {}
  }
}
</script>

<style lang="sass">
</style>
