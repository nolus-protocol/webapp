<template>
  <div :class="showMobileNav ? 'mobile-nav' : false" class="sidebar-container">
    <div class="top">
      <LogoLink link="/"></LogoLink>

      <div
        class="sidebar-elements-container nls-nav-more flex flex-col mt-nolus-55"
      >
        <div
          :style="
            showMobileNav
              ? 'z-index:5; background-color: #fff;box-shadow: 0px 8px 48px rgba(7, 45, 99, 0.15); transform: translateY(0)'
              : false
          "
          class="lg:hidden"
        >
          <div
            class="nls-nav-link flex flex-start nls-md-flex-row mb-nolus-30 mt-nolus-22"
          >
            <SidebarElement
              id="history"
              href="/history"
              :label="$t('message.history')"
              v-on:click="pushToHistory"
            />
          </div>
          <div class="nls-md-show mb-nolus-24">
            <SidebarSocial />
          </div>
        </div>

        <div class="md:flex md:justify-between sidebar-elements-block lg:block">
          <div class="block nls-nav-link">
            <SidebarElement
              id="assets"
              href="/"
              :label="$t('message.assets')"
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
            <SidebarElement id="trade" href="#" :label="$t('message.trade')" />
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

          <div class="block nls-nav-link nls-md-show">
            <SidebarElement
              id="more"
              :label="$t('message.more')"
              v-on:click="showMobileNav = !showMobileNav"
            />
          </div>
        </div>
      </div>
    </div>
    <SidebarSocial />
    <div class="backdrop"></div>
  </div>
</template>
<script type="ts">
import LogoLink from '@/components/LogoLink.vue'
import SidebarElement from '@/components/SidebarElement.vue'
import SidebarSocial from '@/components/SidebarSocial.vue'
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
      DISCORD_ACCOUNT: DISCORD_ACCOUNT

    }
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
