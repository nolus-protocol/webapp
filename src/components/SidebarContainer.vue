<template>
  <div
    :class="{ 'mobile-nav': showMobileNav }"
    class="sidebar-container"
    ref="sidebar"
  >
    <div class="top pl-8">
      <LogoLink link="/" />
      <div class="sidebar-elements-container nls-nav-more flex flex-col mt-[55px]">
        <div
          :style="
            showMobileNav
              ? 'z-index: 5;box-shadow: 0px 8px 48px rgba(7, 45, 99, 0.15); transform: translateY(-104px)'
              : ''
          "
          class="lg:hidden nls-border mb-[-1px] mobile-transition-taskbar"
        >
          <div class="nls-nav-link flex flex-start nls-md-flex-row mt-[6px]">
            <SidebarElement
              id="governance"
              :label="$t('message.vote')"
              target="_blank"
              @click="openExternal(governUrl, '_blank')"
            />
          </div>
          <div class="nls-nav-link flex flex-start nls-md-flex-row mb-[112px]">
            <SidebarElement
              id="history"
              href="/history"
              :label="$t('message.history')"
              @click="pushTo(RouteNames.HISTORY)"
            />
          </div>
        </div>

        <!-- DESKTOP -->
        <div class="md:flex md:justify-between sidebar-elements-block lg:block task-bar">
          <div class="block nls-nav-link icon">
            <SidebarElement
              id="assets"
              href="/"
              :label="$t('message.assets')"
              @click="pushTo(RouteNames.DASHBOARD)"
            />
          </div>
          <div class="block nls-nav-link icon">
            <SidebarElement
              id="lease"
              href="/lease"
              :label="$t('message.lease')"
              @click="pushTo(RouteNames.LEASE)"
            />
          </div>
          <div class="block nls-nav-link icon hidden">
            <SidebarElement
              id="trade"
              href="#"
              :label="$t('message.swap')"
              @click="openSwapModal"
            />
          </div>
          <div class="block nls-nav-link icon">
            <SidebarElement
              id="earn"
              href="/earn"
              :label="$t('message.earn')"
              @click="pushTo(RouteNames.EARN)"
            />
          </div>
          <div class="block nls-nav-link icon nls-md-hidden">
            <SidebarElement
              id="history"
              href="/history"
              :label="$t('message.history')"
              @click="pushTo(RouteNames.HISTORY)"
            />
          </div>
          <div class="block nls-nav-link icon nls-md-hidden">
            <SidebarElement
              id="governance"
              :label="$t('message.vote')"
              @click="openExternal(governUrl, '_blank')"
            />
          </div>
          <div class="block nls-nav-link nls-md-show">
            <SidebarElement
              id="more"
              @click="showMobileNav = !showMobileNav"
              :label="isMobile ? $t('message.more') : $t('message.settings')"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="lg:bot lg:pb-8 pl-8">
      <div class="flex items-center sub-nav-social hidden">
        <SidebarElement
          id="twitter"
          icon="/src/assets/icons/twitter.svg"
          @click="openExternal(TWITTER_ACCOUNT, '_blank')"
        />
        <SidebarElement
          id="telegram"
          icon="/src/assets/icons/telegram.svg"
          @click="openExternal(TELEGRAM_ACCOUNT, '_blank')"
        />
        <SidebarElement
          id="discord"
          icon="/src/assets/icons/discord.svg"
          @click="openExternal(DISCORD_ACCOUNT, '_blank')"
        />
        <SidebarElement
          id="reddit"
          icon="/src/assets/icons/reddit.svg"
          @click="openExternal(REDDIT_ACCOUNT, '_blank')"
        />
      </div>
      <div class="block mt-3 text-12 garet-medium sub-nav-service"></div>
    </div>
  </div>

  <div class="lg:col-span-3 absolute inset-x-0 bottom-0 mb-6 ml-8 hidden md:grid fixed">
    <p class="nls-font-500 text-12 text-dark-grey text-upper pl-2">
      {{ applicaton.network.networkName }} #<template v-if="block > 0">{{ block }}</template>
    </p>
    <p class="garet-medium text-12 text-dark-grey pl-2">v{{ version }}</p>
  </div>

  <Modal
    v-if="showSwapModal"
    @close-modal="showSwapModal = false"
    route="swap"
  >
    <SwapDialog />
  </Modal>
</template>

<script lang="ts" setup>
import router from "@/router";
import LogoLink from "@/components/LogoLink.vue";
import SidebarElement from "@/components/SidebarElement.vue";
import Modal from "@/components/modals/templates/Modal.vue";
import SwapDialog from "@/components/modals/SwapDialog.vue";

import { onMounted, onUnmounted, ref, watch } from "vue";
import { RouteNames } from "@/router/RouterNames";

import { useApplicationStore } from "@/stores/application";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { NETWORKS, UPDATE_BLOCK_INTERVAL } from "@/config/env";
import { storeToRefs } from "pinia";
import { EnvNetworkUtils } from "@/utils";
import { DISCORD_ACCOUNT, REDDIT_ACCOUNT, TELEGRAM_ACCOUNT, TWITTER_ACCOUNT } from "@/config/globals";
import { ApptUtils } from "@/utils/AppUtils";

const showMobileNav = ref(false);
const isMobile = ref(false);
const showSwapModal = ref(false);
const block = ref(0);
const version = ref("");
const applicaton = useApplicationStore();
const applicationRef = storeToRefs(applicaton);
const sidebar = ref(null as HTMLDivElement | null);
const governUrl = NETWORKS[EnvNetworkUtils.getStoredNetworkName()].govern;

let blockInterval: NodeJS.Timeout | undefined;

onMounted(() => {
  isMobile.value = screen?.width < 576;

  if (isMobile.value) {
    document.addEventListener("click", onClick);
  }

  setBlock();
  setVersion();
  blockInterval = setInterval(() => {
    setBlock();
    blockInterval;
  }, UPDATE_BLOCK_INTERVAL);
});

onUnmounted(() => {
  clearInterval(blockInterval);
  if (isMobile.value) {
    document.removeEventListener("click", onClick);
  }
});

watch(
  () => applicationRef.network.value?.networkAddresses,
  () => {
    setBlock();
    setVersion();
  }
);

watch(
  () => applicationRef.sessionExpired.value,
  (value) => {
    if(value){
      clearInterval(blockInterval);
    }
  }
);

function onClick(event: MouseEvent) {
  if (isMobile.value) {
    const isClickedOutside = sidebar.value?.contains(event.target as Node);
    if (!isClickedOutside) {
      showMobileNav.value = false;
    }
  }
};

async function setBlock () {
  try {
    const nolusClient = NolusClient.getInstance();
    block.value = await nolusClient.getBlockHeight();
  } catch (error: Error | any) {
    console.log(error);
  }
}

async function setVersion () {
  try {
    const url = (await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;

    const data = await fetch(`${url}/abci_info`);
    const res = await data.json();
    version.value = res?.result?.response.version;
  } catch (error: Error | any) {
    console.log(error);
  }
}

function openSwapModal() {
  showSwapModal.value = true;
}

function pushTo(route: RouteNames) {
  router.push({ name: route });
  if (showMobileNav.value) {
    showMobileNav.value = false;
  }
}

function openExternal(url: string, target: string) {
  window.open(url, target);
}
</script>

<style lang="scss" scoped>
#governance:after {
  content: "\e801";
  font-family: "nolus";
  margin-left: 7px;
}

div.nls-nav-link {
  span.icon {
    width: 32px;
    height: 24px;
  }
}
</style>
