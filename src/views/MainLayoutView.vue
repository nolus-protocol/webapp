<template>
  <div
    v-cloak
    class="lg:container w-full lg:grid lg:grid-cols-12 mx-auto grid-parent md-nls-px-25 sm-nls-0 body background-dark"
  >
    <div class="lg:col-span-3">
      <SidebarContainer />
    </div>
    <div class="lg:col-span-9 pb-8">
      <div class="grid grid-cols-10 grid-child">
        <div class="col-span-12 mt-[60px]">
          <div class="col-span-12">
            <div class="sidebar-header">
              <SidebarHeader />
            </div>
          </div>
        </div>
        <router-view />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import SidebarContainer from '@/components/SidebarContainer.vue';
import SidebarHeader from '@/components/Sideheader.vue';
</script>
