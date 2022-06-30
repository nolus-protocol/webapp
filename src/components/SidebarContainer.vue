<template>
  <div class="sidebar-container">
    <div class="top">
      <LogoLink link="/"></LogoLink>

      <div class="sidebar-elements-container block mt-nolus-55">
        <div class="block nls-nav-link">
          <SidebarElement
            id="assets"
            label="Assets"
            href="/"
            :icon="require('@/assets/icons/assets.svg')"
            :iconHover="require('@/assets/icons/assets_active.svg')"
          >
          </SidebarElement>
        </div>
        <div class="block nls-nav-link">
          <SidebarElement
            id="lease"
            v-on:click="pushToLease"
            label="Lease"
            href="/lease"
            :icon="require('@/assets/icons/lease.svg')"
            :iconHover="require('@/assets/icons/lease_active.svg')"
          >
          </SidebarElement>
        </div>
        <div class="block nls-nav-link">
          <SidebarElement
            id="trade"
            href="#"
            label="Trade"
            :icon="require('@/assets/icons/trade.svg')"
            :iconHover="require('@/assets/icons/trade_active.svg')"
          >
          </SidebarElement>
        </div>
        <div class="block nls-nav-link">
          <SidebarElement
            id="earn"
            label="Earn"
            href="/earn"
            v-on:click="pushToEarn"
            :icon="require('@/assets/icons/earn.svg')"
            :iconHover="require('@/assets/icons/earn_active.svg')"
          >
          </SidebarElement>
        </div>
        <div class="block nls-nav-link">
          <SidebarElement
            id="history"
            v-on:click="pushToHistory"
            label="History"
            href="/history"
            :icon="require('@/assets/icons/history.svg')"
            :iconHover="require('@/assets/icons/history_active.svg')"
          >
          </SidebarElement>
        </div>
      </div>
    </div>
    <div class="bot pb-8">
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
        <!-- this.$route.path == this.href ? 'active' : false, -->
      </div>
    </div>
  </div>
</template>
<script type="ts">
import LogoLink from '@/components/LogoLink.vue';
import SidebarElement from '@/components/SidebarElement.vue';
import SidebarSocialElement from '@/components/SidebarSocialElement.vue';
import SidebarLinkElement from '@/components/SidebarLinkElement.vue';
import WalletOpen from "@/components/WalletOpen.vue";
import { BellIcon } from '@heroicons/vue/solid';
import {
  DISCORD_ACCOUNT,
  LINKEDIN_ACCOUNT,
  MEDIUM_ACCOUNT,
  REDDIT_ACCOUNT,
  TELEGRAM_ACCOUNT,
  TWITTER_ACCOUNT
} from '@/constants/webapp';
import router from '@/router';
import { RouteNames } from '@/router/RouterNames';

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
      //MEDIUM_ACCOUNT: rou,
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
