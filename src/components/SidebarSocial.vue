<template>
  <div class="lg:bot lg:pb-8">
    <div class="flex items-center sub-nav-social">
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
        id="reddit"
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
    <div class="block mt-3 nls-12 nls-font-400 sub-nav-service">
      <SidebarLinkElement
        id="term-of-service"
        href="#"
        label="Terms of Service"
      >
      </SidebarLinkElement>
      <!-- this.$route.path == this.href ? 'active' : false, -->
    </div>
  </div>
</template>
<script type="ts">
import LogoLink from '@/components/LogoLink.vue'
import SidebarElement from '@/components/SidebarElement.vue'
import SidebarSocialElement from '@/components/SidebarSocialElement.vue'
import SidebarLinkElement from '@/components/SidebarLinkElement.vue'
import {
  DISCORD_ACCOUNT,
  LINKEDIN_ACCOUNT,
  REDDIT_ACCOUNT,
  TELEGRAM_ACCOUNT,
  TWITTER_ACCOUNT
} from '@/constants/webapp'

export default {
  name: 'SidebarContainer',
  components: {
    LogoLink,
    SidebarElement,
    SidebarSocialElement,
    SidebarLinkElement
  },
  props: [],
  data () {
    return {
      showWalletPopup: false,
      TWITTER_ACCOUNT: TWITTER_ACCOUNT,
      TELEGRAM_ACCOUNT: TELEGRAM_ACCOUNT,
      // MEDIUM_ACCOUNT: rou,
      REDDIT_ACCOUNT: REDDIT_ACCOUNT,
      LINKEDIN_ACCOUNT: LINKEDIN_ACCOUNT,
      DISCORD_ACCOUNT: DISCORD_ACCOUNT
    }
  }

}
</script>
