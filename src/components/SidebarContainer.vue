<template>
  <div class="sidebar-container">
    <LogoLink
      href="#"
    ></LogoLink>

    <div class="block p-8">
      <div class="block">
        <SidebarElement
          id="assets"
          href="#"
          label="Assets"
          icon="@/assets/icons/diamond-o.svg"
          iconHover="@/assets/icons/diamond-o.svg"
        >
        </SidebarElement>
      </div>
      <div class="block mt-3">
        <SidebarElement
          id="lease"
          href="#"
          label="Lease"
          icon="@/assets/icons/lease.svg"
          iconHover="@/assets/icons/diamond-o.svg"
        >
        </SidebarElement>
      </div>
      <div class="block mt-3">
        <SidebarElement
          id="trade"
          href="#"
          label="Trade"
          icon="@/assets/icons/trade.svg"
          iconHover="@/assets/icons/diamond-o.svg"
        >
        </SidebarElement>
      </div>
      <div class="block mt-3">
        <SidebarElement
          id="earn"
          href="#"
          label="Earn"
          icon="@/assets/icons/earn.svg"
          iconHover="@/assets/icons/diamond-o.svg"
        >
        </SidebarElement>
      </div>
      <div class="block mt-3">
        <SidebarElement
          id="history"
          href="#"
          label="History"
          icon="@/assets/icons/history.svg"
          iconHover="@/assets/icons/diamond-o.svg"
        >
        </SidebarElement>
      </div>
    </div>
  </div>
</template>
<script type="ts">
import LogoLink from '@/components/LogoLink.vue'
import SidebarElement from '@/components/SidebarElement.vue'

export default {
  name: 'SidebarContainer',
  components: {
    LogoLink,
    SidebarElement
  },
  props: []
}
</script>
