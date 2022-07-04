<template>
  <div :class="showMobileNav ? 'mobile-nav' : false" class="sidebar-container">
    <div class="top">
      <LogoLink link="/"></LogoLink>

      <div
        class="sidebar-elements-container nls-nav-more flex flex-col mt-nolus-55"
      >
        <!-- z-index: 5;
					background-color: $white;
					transform: translateY(0);
					padding: 24px; -->
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
              label="History"
              v-on:click="pushToHistory"
            >
            </SidebarElement>
          </div>
          <div class="nls-md-show mb-nolus-24">
            <SidebarSocial/>
          </div>
        </div>

        <div class="md:flex md:justify-between sidebar-elements-block lg:block">
          <div class="block nls-nav-link">
            <SidebarElement id="assets" href="/" label="Assets">
            </SidebarElement>
          </div>
          <div class="block nls-nav-link">
            <SidebarElement
              id="lease"
              href="/lease"
              label="Lease"
              v-on:click="pushToLease"
            >
            </SidebarElement>
          </div>
          <div class="block nls-nav-link">
            <SidebarElement id="trade" href="#" label="Trade"></SidebarElement>
          </div>
          <div class="block nls-nav-link">
            <SidebarElement
              id="earn"
              href="/earn"
              label="Earn"
              v-on:click="pushToEarn"
            >
            </SidebarElement>
          </div>
          <div class="block nls-nav-link nls-md-hidden">
            <SidebarElement
              id="history"
              href="/history"
              label="History"
              v-on:click="pushToHistory"
            >
            </SidebarElement>
          </div>

          <div class="block nls-nav-link nls-md-show">
            <SidebarElement
              id="more"
              label="More"
              v-on:click="showMobileNav = !showMobileNav"
            >
            </SidebarElement>
          </div>
        </div>
      </div>
    </div>
    <SidebarSocial/>
    <div class="backdrop"></div>
  </div>
</template>
<script type="ts">
import LogoLink from '@/components/LogoLink.vue'
import SidebarElement from '@/components/SidebarElement.vue'
import SidebarSocialElement from '@/components/SidebarSocialElement.vue'
import SidebarLinkElement from '@/components/SidebarLinkElement.vue'
import WalletOpen from '@/components/WalletOpen.vue'
import SidebarSocial from '@/components/SidebarSocial.vue'
import { BellIcon } from '@heroicons/vue/solid'
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
