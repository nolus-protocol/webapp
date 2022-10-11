<template>
  <button class="btn btn-primary btn-large-primary mr-4" @click="openSnackBar">
    Show Snackbar
  </button>

  <div ref="snackbar" id="snackbar" class="snackbar">
    <div>
      <span v-if="icon" :class="icon" class="icon text text-16 nls-font-500" />
      <span v-if="mainContent" class="text text-16 nls-font-500 mr-1">{{
        mainContent
      }}</span>
      <span v-if="plainContent" class="text text-14 nls-font-400">{{
        plainContent
      }}</span>
    </div>

    <span class="icon-close" @click="closeSnackBar"></span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps({
  icon: {
    type: String,
  },
  mainContent: {
    type: String,
  },
  plainContent: {
    type: String,
  },
});

const snackbar = ref(null as HTMLElement | null);

const openSnackBar = () => {
  const element = snackbar.value;
  if (element) {
    element.className = 'show';
    setTimeout(() => {
      element.className = element.className.replace('show', '');
    }, 3000);
  }
};

const closeSnackBar = () => {
  const element = snackbar.value!;
  if (element) {
    element.className = 'show';
    element.className = element.className.replace('show', '');
  }
};

</script>
