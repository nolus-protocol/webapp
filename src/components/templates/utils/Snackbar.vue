<template>
  <button @click="openSnackBar" class="btn btn-primary btn-large-primary mr-4">
    Show Snackbar
  </button>

  <div id="snackbar" class="snackbar">
    <div>
      <span v-if="icon" class="icon text nls-16 nls-font-500" :class="icon" />
      <span v-if="mainContent" class="text nls-16 nls-font-500 mr-1">{{
        mainContent
      }}</span>
      <span v-if="plainContent" class="text nls-14 nls-font-400">{{
        plainContent
      }}</span>
    </div>

    <span class="icon-close" @click="closeSnackBar"></span>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "SnackBar",
  props: ["icon", "mainContent", "plainContent"],
  data() {
    return {
      snackBarComponent: null as any,
    };
  },
  mounted() {
    this.snackBarComponent = document.getElementById("snackbar");
  },
  methods: {
    openSnackBar() {
      let test = this.snackBarComponent;
      test.className = "show";
      setTimeout(function () {
        test.className = test.className.replace("show", "");
      }, 3000);
    },
    closeSnackBar() {
      let test = this.snackBarComponent;
      test.className = "show";
      test.className = test.className.replace("show", "");
    },
  },
});
</script>
