<template>
  <div class="sidebar-container">
    <div class="top">
      <LogoLink
        href="#"
      ></LogoLink>

      <div class="sidebar-elements-container block p-8">
        <div class="block">
          <SidebarElement
            id="assets"
            href="#"
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
            href="#"
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
            href="#"
            label="Earn"
            :icon="require('@/assets/icons/earn.svg')"
            :iconHover="require('@/assets/icons/earn_active.svg')"
          >
          </SidebarElement>
        </div>
        <div class="block">
          <SidebarElement
            id="history"
            href="#"
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
          href="#"
          :icon="require('@/assets/icons/twitter.svg')"
        >
        </SidebarSocialElement>
        <SidebarSocialElement
          id="telegram"
          href="#"
          :icon="require('@/assets/icons/telegram.svg')"
        >
        </SidebarSocialElement>
        <SidebarSocialElement
          id="discord"
          href="#"
          :icon="require('@/assets/icons/discord.svg')"
        >
        </SidebarSocialElement>
        <SidebarSocialElement
          id="redit"
          href="#"
          :icon="require('@/assets/icons/redit.svg')"
        >
        </SidebarSocialElement>
        <SidebarSocialElement
          id="medium"
          href="#"
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
</template>
<script type="ts">
import LogoLink from '@/components/LogoLink.vue'
import SidebarElement from '@/components/SidebarElement.vue'
import SidebarSocialElement from '@/components/SidebarSocialElement.vue'
import SidebarLinkElement from '@/components/SidebarLinkElement.vue'

export default {
  name: 'SidebarContainer',
  components: {
    LogoLink,
    SidebarElement,
    SidebarSocialElement,
    SidebarLinkElement
  },
  props: []
}
</script>
