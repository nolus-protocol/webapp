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
              ? 'z-index:5; background-color: #fff;box-shadow: 0px 8px 48px rgba(7, 45, 99, 0.15); transform: translateY(0)'
              : false
          "
          class="lg:hidden"
        >
          <div class="nls-nav-link flex flex-start nls-md-flex-row mt-[22px]">
            <SidebarElement
              id="history"
              href="/history"
              :label="$t('message.history')"
              v-on:click="pushToHistory"
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
              v-on:click="pushToDashboard"
            />
          </div>
          <div class="block nls-nav-link">
            <SidebarElement
              id="lease"
              href="/lease"
              :label="$t('message.lease')"
              v-on:click="pushToLease"
            />
          </div>
          <div class="block nls-nav-link">
            <SidebarElement id="trade" href="#" :label="$t('message.trade')"/>
          </div>
          <div class="block nls-nav-link">
            <SidebarElement
              id="earn"
              href="/earn"
              :label="$t('message.earn')"
              v-on:click="pushToEarn"
            />
          </div>
          <div class="block nls-nav-link nls-md-hidden">
            <SidebarElement
              id="history"
              href="/history"
              :label="$t('message.history')"
              v-on:click="pushToHistory"
            />
          </div>
          <div class="block nls-nav-link nls-md-hidden">
            <SidebarElement
              id="governance"
              label="Govern"
              target="_blank"
              v-on:click="openExternal('https://wallet.keplr.app/#/dashboard', '_blank')"
            />
          </div>
          <div class="block nls-nav-link nls-md-show">
            <SidebarElement
              id="more"
              v-on:click="showMobileNav = !showMobileNav"
              :label="this.isMobile ? 'More' : 'Settings'"
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
        target="_blkank"
        v-on:click="openExternal(TWITTER_ACCOUNT, '_blank')"
      />
      <SidebarElement
        id="telegram"
        :icon="require('@/assets/icons/telegram.svg')"
        target="_blkank"
        v-on:click="openExternal(TELEGRAM_ACCOUNT, '_blank')"
      />
      <SidebarElement
        id="discord"
        :icon="require('@/assets/icons/discord.svg')"
        target="_blkank"
        v-on:click="openExternal(DISCORD_ACCOUNT, '_blank')"
      />
      <SidebarElement
        id="reddit"
        :icon="require('@/assets/icons/reddit.svg')"
        target="_blkank"
        v-on:click="openExternal(REDDIT_ACCOUNT, '_blank')"
      />
      <SidebarElement
        id="medium"
        :icon="require('@/assets/icons/medium.svg')"
        target="_blkank"
        v-on:click="openExternal(MEDIUM_ACCOUNT, '_blank')"
      />
    </div>
    <div class="block mt-3 nls-12 nls-font-400 sub-nav-service">
      <!-- <SidebarElement
        id="term-of-service"
        href="#"
        :label="$t('message.term-of-service')"
        target="_blkank"
      /> -->
      <!-- this.$route.path == this.href ? 'active' : false, -->
    </div>
  </div>
    <div class="backdrop"></div>
  </div>
</template>
<script lang="ts">
import LogoLink from '@/components/LogoLink.vue'
import SidebarElement from '@/components/SidebarElement.vue'
import {
  DISCORD_ACCOUNT,
  LINKEDIN_ACCOUNT,
  REDDIT_ACCOUNT,
  TELEGRAM_ACCOUNT,
  TWITTER_ACCOUNT,
  MEDIUM_ACCOUNT
} from '@/constants/webapp'
import router from '@/router'
import { RouteNames } from '@/router/RouterNames'

export default {
  name: 'SidebarContainer',
  components: {
    LogoLink,
    SidebarElement
  },
  props: [],
  data () {
    return {
      showMobileNav: false,
      showWalletPopup: false,
      TWITTER_ACCOUNT: TWITTER_ACCOUNT,
      TELEGRAM_ACCOUNT: TELEGRAM_ACCOUNT,
      REDDIT_ACCOUNT: REDDIT_ACCOUNT,
      LINKEDIN_ACCOUNT: LINKEDIN_ACCOUNT,
      DISCORD_ACCOUNT: DISCORD_ACCOUNT,
      MEDIUM_ACCOUNT: MEDIUM_ACCOUNT,
      isMobile: false
    }
  },
  mounted () {
    this.isMobile = screen?.width < 576
  },
  methods: {
    toggleWalletPopup () {
      this.showWalletPopup = !this.showWalletPopup
    },
    pushToHistory () {
      router.push({ name: RouteNames.HISTORY })
    },
    pushToLease () {
      router.push({ name: RouteNames.LEASE })
    },
    pushToDashboard () {
      router.push({ name: RouteNames.DASHBOARD })
    },
    pushToEarn () {
      router.push({ name: RouteNames.EARN })
    },
    openExternal (url: string, target: string) {
      window.open(url, target)
    }
  }
}
</script>
<style lang="scss" scoped>
[target="_blank"]:after {
  content: "\e801";
  font-family: "nolus";
  margin-left: 7px;
}
</style>
