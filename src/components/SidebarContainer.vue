<template>
  <div class="sidebar-container" :class="showMobileNav ? 'mobile-nav' : false">
    <div class="top">
      <LogoLink link="/"></LogoLink>

      <div
        class="sidebar-elements-container nls-nav-more flex flex-col mt-nolus-55"
      >
        <div
          class="lg:hidden"
          :style="
            showMobileNav
              ? 'z-index:5; background-color: #fff;box-shadow: 0px 8px 48px rgba(7, 45, 99, 0.15); transform: translateY(0)'
              : false
          "
        >
          <div class="nls-nav-link flex flex-start nls-md-flex-row mt-nolus-22">
            <SidebarElement
              id="history"
              v-on:click="pushToHistory"
              label="History"
              href="/history"
            >
            </SidebarElement>
          </div>
          <div class="nls-nav-link flex flex-start nls-md-flex-row mb-nolus-30">
            <SidebarElement
              id="governance"
              label="Govern"
              href="https://wallet.keplr.app/#/dashboard"
              target="_blank"
            >
            </SidebarElement>
          </div>
          <div class="nls-md-show mb-nolus-24">
            <SidebarSocial />
          </div>
        </div>

        <div class="md:flex md:justify-between sidebar-elements-block lg:block">
          <div class="block nls-nav-link">
            <SidebarElement id="assets" label="Assets" href="/">
            </SidebarElement>
          </div>
          <div class="block nls-nav-link">
            <SidebarElement
              id="lease"
              v-on:click="pushToLease"
              label="Lease"
              href="/lease"
            >
            </SidebarElement>
          </div>
          <div class="block nls-nav-link">
            <SidebarElement id="trade" href="#" label="Trade"> </SidebarElement>
          </div>
          <div class="block nls-nav-link">
            <SidebarElement
              id="earn"
              label="Earn"
              href="/earn"
              v-on:click="pushToEarn"
            >
            </SidebarElement>
          </div>
          <div class="block nls-nav-link nls-md-hidden">
            <SidebarElement
              id="history"
              v-on:click="pushToHistory"
              label="History"
              href="/history"
            >
            </SidebarElement>
          </div>

          <div class="block nls-nav-link nls-md-show">
            <SidebarElement
              id="more"
              v-on:click="showMobileNav = !showMobileNav"
              :label="this.isMobile ? 'More' : 'Settings'"
            >
            </SidebarElement>
          </div>
          <div class="block nls-nav-link nls-md-hidden">
            <SidebarElement
              id="governance"
              label="Govern"
              href="https://wallet.keplr.app/#/dashboard"
              target="_blank"
            >
            </SidebarElement>
          </div>
        </div>
      </div>
    </div>
    <SidebarSocial />
    <div class="backdrop"></div>
  </div>
</template>
<script type="ts">
import LogoLink from '@/components/LogoLink.vue';
import SidebarElement from '@/components/SidebarElement.vue';
import SidebarSocialElement from '@/components/SidebarSocialElement.vue';
import SidebarLinkElement from '@/components/SidebarLinkElement.vue';
import WalletOpen from "@/components/WalletOpen.vue";
import SidebarSocial from "@/components/SidebarSocial.vue";
import { BellIcon } from '@heroicons/vue/solid';
import {
  DISCORD_ACCOUNT,
  LINKEDIN_ACCOUNT,
  REDDIT_ACCOUNT,
  TELEGRAM_ACCOUNT,
  TWITTER_ACCOUNT
} from '@/constants/webapp'
import router from '@/router'
import { RouteNames } from '@/router/RouterNames'

export default {
  name: 'SidebarContainer',
  components: {
    LogoLink,
    SidebarElement,
    SidebarSocialElement,
    SidebarLinkElement,
    BellIcon,
    WalletOpen,
    SidebarSocial
  },
  props: [],
  data () {
    return {
      showMobileNav: false,
      showWalletPopup: false,
      TWITTER_ACCOUNT: TWITTER_ACCOUNT,
      TELEGRAM_ACCOUNT: TELEGRAM_ACCOUNT,
      // MEDIUM_ACCOUNT: rou,
      REDDIT_ACCOUNT: REDDIT_ACCOUNT,
      LINKEDIN_ACCOUNT: LINKEDIN_ACCOUNT,
      DISCORD_ACCOUNT: DISCORD_ACCOUNT,
  isMobile: false,
    }
  },
mounted() {
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
