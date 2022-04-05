<template>
  <div class="grid grid-cols-4 gap-6 border-b border-standart py-3 px-6 items-center">

    <!-- Ticker -->
    <div class="inline-flex items-center">
      <img
        :src="require('@/assets/icons/coins/'+ this.icon)"
        width="32"
        height="32"
        class="inline-block m-0 mr-4"
      />
      <div class="inline-block">
        <p class="text-primary text-medium text-small-heading text-left uppercase m-0">{{ this.ticker }}</p>
        <p class="text-dark-grey text-small-copy text-left capitalize m-0">{{ this.fullName }}</p>
      </div>
    </div>

    <!-- Price -->
    <div class="block">
      <p class="text-primary text-medium text-large-copy text-right m-0">${{ this.price }}</p>
      <div class="flex items-center justify-end text-primary text-small-copy text-right m-0">
        <img 
          :src="require('@/assets/icons/change-'+ (this.changeDirection ? 'positive' : 'negative') +'.svg')"
          class="inline-block m-0 mr-2"
        />
        <span class="inline-block">
          {{ this.change }}%
        </span>
      </div>
    </div>

    <!-- Balance -->
    <div class="block">
      <p class="text-primary text-medium text-large-copy text-right m-0">${{ this.balance }}</p>
      <div class="flex items-center justify-end text-dark-grey text-small-copy text-right m-0">
        {{ this.balanceOther }}
        {{ this.balanceOtherTicker }}
      </div>
    </div>

    <!-- Earnings -->
    <div class="block">
      <div class="flex items-center justify-end text-primary text-medium text-small-copy text-right m-0">
        Up to {{ this.earnings }}% APY
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'AssetPartial',
  props: {
    icon: {
      type: String,
    },
    ticker: {
      type: String,
    },
    fullName: {
      type: String,
    },
    price: {
      type: String,
    },
    change: {
      type: String,
    },
    changeDirection: {
      type: Boolean,
    },
    balance: {
      type: String,
    },
    balanceOther: {
      type: String,
    },
    balanceOtherTicker: {
      type: String,
    },
    earnings: {
      type: String,
    }
  },
  data () {
    return {
      default: {
        value: ''
      }
    }
  }
}
</script>
