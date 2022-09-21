<template>
  <div :class="showMobileNav ? 'mobile-nav' : false" class="sidebar-container">
    <div class="top">
      <LogoLink link="/" />
      <div
        class="sidebar-elements-container nls-nav-more flex flex-col mt-[55px]"
      >
        <div
          :style="
            showMobileNav
              ? 'z-index: 5; background-color: #fff;box-shadow: 0px 8px 48px rgba(7, 45, 99, 0.15); transform: translateY(0)'
              : ''
          "
          class="lg:hidden"
        >
          <div class="nls-nav-link flex flex-start nls-md-flex-row mt-[22px]">
            <SidebarElement
              id="history"
              href="/history"
              :label="$t('message.history')"
              v-on:click="pushTo(RouteNames.HISTORY)"
            />
          </div>
          <div class="nls-nav-link flex flex-start nls-md-flex-row mb-[30px]">
            <SidebarElement
              id="governance"
              label="Govern"
              target="_blank"
              v-on:click="openExternal('https://wallet.keplr.app/#/dashboard', '_blank')"
            />
          </div>
        </div>

        <div class="md:flex md:justify-between sidebar-elements-block lg:block">
          <div class="block nls-nav-link">
            <SidebarElement
              id="assets"
              href="/"
              :label="$t('message.assets')"
              v-on:click="pushTo(RouteNames.DASHBOARD)"
            />
          </div>
          <div class="block nls-nav-link">
            <SidebarElement
              id="lease"
              href="/lease"
              :label="$t('message.lease')"
              v-on:click="pushTo(RouteNames.LEASE)"
            />
          </div>
          <div class="block nls-nav-link">
            <SidebarElement
              id="trade"
              href="#"
              :label="$t('message.swap')"
              @click="openSwapModal"/>
          </div>
          <div class="block nls-nav-link">
            <SidebarElement
              id="earn"
              href="/earn"
              :label="$t('message.earn')"
              v-on:click="pushTo(RouteNames.EARN)"
            />
          </div>
          <div class="block nls-nav-link nls-md-hidden">
            <SidebarElement
              id="history"
              href="/history"
              :label="$t('message.history')"
              v-on:click="pushTo(RouteNames.HISTORY)"
            />
          </div>
          <div class="block nls-nav-link nls-md-hidden">
            <SidebarElement
              id="governance"
              label="Govern"
              v-on:click="openExternal('https://wallet.keplr.app/#/dashboard', '_blank')"
            />
          </div>
          <div class="block nls-nav-link nls-md-show">
            <SidebarElement
              id="more"
              v-on:click="showMobileNav = !showMobileNav"
              :label="isMobile ? 'More' : 'Settings'"
            />
          </div>
        </div>
      </div>
    </div>
 <div class="lg:bot lg:pb-8">
    <div class="flex items-center sub-nav-social">
      <SidebarElement
        id="twitter"
        :icon="require('@/assets/icons/twitter.svg')"
        v-on:click="openExternal(TWITTER_ACCOUNT, '_blank')"
      />
      <SidebarElement
        id="telegram"
        :icon="require('@/assets/icons/telegram.svg')"
        v-on:click="openExternal(TELEGRAM_ACCOUNT, '_blank')"
      />
      <SidebarElement
        id="discord"
        :icon="require('@/assets/icons/discord.svg')"
        v-on:click="openExternal(DISCORD_ACCOUNT, '_blank')"
      />
      <SidebarElement
        id="reddit"
        :icon="require('@/assets/icons/reddit.svg')"
        v-on:click="openExternal(REDDIT_ACCOUNT, '_blank')"
      />
    </div>

    <p class="nls-font-500 text-12 text-dark-grey text-upper pl-2">
      MAINNET # 4,987,868
    </p>

    <p class="nls-font-400 text-12 text-dark-grey pl-2">
      v0.1.3-8c231c5
    </p>

    <div class="block mt-3 text-12 nls-font-400 sub-nav-service"/>
  </div>
    <div class="backdrop"/>
  </div>

  <Modal v-if="showSwapModal" @close-modal="showSwapModal = false">
    <SwapDialog/>
  </Modal>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'

import LogoLink from '@/components/LogoLink.vue'
import SidebarElement from '@/components/SidebarElement.vue'
import {
  DISCORD_ACCOUNT,
  REDDIT_ACCOUNT,
  TELEGRAM_ACCOUNT,
  TWITTER_ACCOUNT,
} from '@/constants/webapp'
import router from '@/router'
import { RouteNames } from '@/router/RouterNames'
import Modal from '@/components/modals/templates/Modal.vue'
import SwapDialog from '@/components/modals/SwapDialog.vue'

const showMobileNav = ref(false)
const isMobile = ref(false)
const showSwapModal = ref(false)

onMounted(() => {
  isMobile.value = screen?.width < 576
})

function openSwapModal () {
  showSwapModal.value = true
}

function pushTo (route: RouteNames) {
  router.push({ name: route })
}

function openExternal (url: string, target: string) {
  window.open(url, target)
}
</script>

<style lang="scss" scoped>
[target="_blank"]:after {
  content: "\e801";
  font-family: "nolus";
  margin-left: 7px;
}
</style>
