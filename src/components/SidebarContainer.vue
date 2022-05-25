<template>
  <div class="sidebar-container">
    <div class="top">
      <LogoLink
        link="/"
      ></LogoLink>

      <div class="sidebar-elements-container block p-8">
        <div class="block">
          <SidebarElement
            id="assets"
            v-on:click="pushToDashboard"
            label="Assets"
            :icon="require('@/assets/icons/assets.svg')"
            :iconHover="require('@/assets/icons/assets_active.svg')"
            :isActive="true"
          >
          </SidebarElement>
        </div>
        <div class="block">
          <SidebarElement
            id="lease"
            v-on:click="pushToLease"
            label="Lease"
            :icon="require('@/assets/icons/lease.svg')"
            :iconHover="require('@/assets/icons/lease_active.svg')"
          >
          </SidebarElement>
        </div>
        <div class="block">
          <SidebarElement
            id="trade"
            href="#"
            label="Trade"
            :icon="require('@/assets/icons/trade.svg')"
            :iconHover="require('@/assets/icons/trade_active.svg')"
          >
          </SidebarElement>
        </div>
        <div class="block">
          <SidebarElement
            id="earn"
            label="Earn"
            :icon="require('@/assets/icons/earn.svg')"
            :iconHover="require('@/assets/icons/earn_active.svg')"
          >
          </SidebarElement>
        </div>
        <div class="block">
          <SidebarElement
            id="history"
            v-on:click="pushToHistory"
            label="History"
            :icon="require('@/assets/icons/history.svg')"
            :iconHover="require('@/assets/icons/history_active.svg')"
          >
          </SidebarElement>
        </div>
      </div>
    </div>
    <div class="bot px-8 pb-8">
      <div class="flex items-center">
        <SidebarSocialElement
          id="twitter"
          :href="TWITTER_ACCOUNT"
          :icon="require('@/assets/icons/twitter.svg')"
        >
        </SidebarSocialElement>
        <SidebarSocialElement
          id="telegram"
          :href="TELEGRAM_ACCOUNT"
          :icon="require('@/assets/icons/telegram.svg')"
        >
        </SidebarSocialElement>
        <SidebarSocialElement
          id="discord"
          :href="DISCORD_ACCOUNT"
          :icon="require('@/assets/icons/discord.svg')"
        >
        </SidebarSocialElement>
        <SidebarSocialElement
          id="redit"
          :href="REDDIT_ACCOUNT"
          :icon="require('@/assets/icons/reddit.svg')"
        >
        </SidebarSocialElement>
        <SidebarSocialElement
          id="medium"
          :href="MEDIUM_ACCOUNT"
          :icon="require('@/assets/icons/medium.svg')"
        >
        </SidebarSocialElement>
      </div>
      <div class="block mt-3">
        <SidebarLinkElement
          id="term-of-service"
          href="#"
          label="Terms of Service"
        >
        </SidebarLinkElement>
      </div>
    </div>
  </div>

  <div class="sidebar-header">
    <button class="btn btn-header shadow-box mr-2">
      <BellIcon class="icon w-4 h-4"/>
      <span class="counter">8</span>
    </button>
    <button class="btn btn-header with-icon shadow-box rounded-r-none" v-on:click="toggleWalletPopup">
      <img
        src="@/assets/icons/money-wallet.svg"
        class="inline-block mr-2"
      />
      <span class="label text-detail">My precious</span>
    </button>
  </div>

  <WalletOpen v-show="showWalletPopup"/>
</template>
<script type="ts">
import LogoLink from '@/components/LogoLink.vue'
import SidebarElement from '@/components/SidebarElement.vue'
import SidebarSocialElement from '@/components/SidebarSocialElement.vue'
import SidebarLinkElement from '@/components/SidebarLinkElement.vue'
import WalletOpen from '@/components/WalletOpen.vue'
import { BellIcon } from '@heroicons/vue/solid'
import {
  DISCORD_ACCOUNT,
  LINKEDIN_ACCOUNT,
  MEDIUM_ACCOUNT,
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
    WalletOpen
  },
  props: [],
  data () {
    return {
      showWalletPopup: false,
      TWITTER_ACCOUNT: TWITTER_ACCOUNT,
      TELEGRAM_ACCOUNT: TELEGRAM_ACCOUNT,
      MEDIUM_ACCOUNT: MEDIUM_ACCOUNT,
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
