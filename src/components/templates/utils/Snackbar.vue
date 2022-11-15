<template>
  <div 
    ref="snackbar" 
    id="snackbar" 
    class="background snackbar">
    <div>
      <template v-if="type == SNACKBAR.Queued">
        <span :class="type" class="icon text text-16 nls-font-500"></span>
      </template>
      <template v-if="type == SNACKBAR.Success">
        <img src="@/assets/icons/success.svg" class="w-5 status">
      </template>
      <template v-if="type == SNACKBAR.Error">
        <img src="@/assets/icons/error.svg" class="w-5 status">
      </template>
      <div class="flex flex-col pl-2">
        <span class="text text-16 nls-font-500 mr-1">
          {{ title }}
        </span>
        <a v-if="type == SNACKBAR.Queued"
          class="url text text-12 nls-font-300">
          {{ $t('message.loading') }}
        </a>
        <a 
          v-else
          class="url text text-14 nls-font-400"
          :href="applicaton.network.networkAddresses.exploler + 'nolus-rila/tx/' + transaction" target="_blank"
          >
          {{ truncateString(transaction) }}
          <img src="@/assets/icons/urlicon.svg" class="w-3 mt-[2px] ml-1 float-right">
        </a>
      </div>
    </div>

    <span class="icon-close" @click="closeSnackBar"></span>
  </div>
</template>

<script setup lang="ts">
import { SNACKBAR } from '@/config/env';
import { useApplicationStore } from '@/stores/application';
import { StringUtils } from '@/utils';
import { computed } from '@vue/reactivity';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const i18n = useI18n();
let timeOut: NodeJS.Timeout;
let closeTimeOut: NodeJS.Timeout;
let visible = false;

const props = defineProps({
  type: {
    type: String,
    required: true
  },
  transaction: {
    type: String,
    default: ''
  },
});

const snackbar = ref(null as HTMLElement | null);
const applicaton = useApplicationStore();

const title = computed(() => {
  return i18n.t(`message.${props.type}`);
});

const openSnackBar = (type: SNACKBAR) => {
  const element = snackbar.value;
  visible = true;
  if (element) {
    element.classList.add('show');
    if (timeOut) {
      clearTimeout(timeOut);
    }
    if(type != SNACKBAR.Queued){
      timeOut = setTimeout(() => {
        closeSnackBar();
      }, 4000);
    }
  }
};

const closeSnackBar = () => {
  const element = snackbar.value!;
  visible = false;
  if (element) {
    if(closeTimeOut){
      clearTimeout(closeTimeOut);
    }
    if(timeOut){
      clearTimeout(timeOut);
    }
    element.classList.remove('show');
    element.classList.add('hide');
    timeOut = setTimeout(() => {
      element.classList.remove('hide');
    }, 500);
  }
};

const truncateString = (text: string) => {
  return StringUtils.truncateString(text, 6, 6);
};

const snackbarVisible = () => {
  return visible;
}

defineExpose({
  openSnackBar,
  snackbarVisible
});

</script>
<style scoped>
#snackbar {
  z-index: 9999999999;
}

.url {
  color: #2868E1;
}

img.status {
  position: absolute;
  left: 15px;
  top: calc(50% - 0.75em);
}
</style>