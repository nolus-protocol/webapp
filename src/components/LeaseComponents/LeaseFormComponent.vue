<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div class="block text-left">
      <div class="block">
        <CurrencyField
          id="amount-investment"
          :currency-options="modelValue.currentBalance"
          :error-msg="modelValue.downPaymentErrorMsg"
          :is-error="modelValue.downPaymentErrorMsg !== ''"
          :option="modelValue.selectedDownPaymentCurrency"
          :step="'1'"
          :value="modelValue.downPayment"
          :label="$t('message.invest-question')"
          name="amountInvestment"
          @input="(event) => (modelValue.downPayment = event.target.value)"
          @update-currency="
            (event) => (modelValue.selectedDownPaymentCurrency = event)
          "
        />
      </div>

      <div class="block mt-[25px]">
        <CurrencyField
          id="amount-interest"
          :currency-options="modelValue.currentBalance"
          :disabled-currency-picker="true"
          :disabled-input-field="disabledInputField"
          :error-msg="modelValue.amountErrorMsg"
          :is-error="modelValue.amountErrorMsg !== ''"
          :option="modelValue.selectedCurrency"
          :value="modelValue.amount"
          :label="$t('message.get-up-to')"
          name="amountInterest"
          @input="(event) => (modelValue.amount = event.target.value)"
          @update-currency="(event) => (modelValue.selectedCurrency = event)"
        />
      </div>
    </div>

    <div class="flex justify-end mt-5 mr-5">
      <p
        v-if="modelValue.selectedCurrency?.balance?.denom"
        class="mb-3 mt-[25px] flex justify-end align-center"
      >
        1
        {{ formatAssetInfo(modelValue.selectedCurrency?.balance?.denom) }} price
        in USD:
        <span class="inline-block nls-font-700 ml-5">{{ pricePerToken }}</span>
      </p>
    </div>
    <div class="flex justify-end">
      <div class="grow-3 text-right nls-font-500 text-14">
        <p class="mb-3 mt-[25px] mr-5">
          {{ $t('message.leased-amount') }}
        </p>
        <p v-if="annualInterestRate" class="mb-3 mr-5"> {{ $t('message.annual-interest') }}</p>
        <p class="mb-3 mt-[25px] mr-5">
          {{ $t('message.liquidation-price') }}
        </p>
      </div>
      <div class="text-right nls-font-700 text-14">
        <p class="mb-3 mt-[25px] flex justify-end align-center">
          {{ calculateLeaseAmount }}
          <TooltipComponent content="Content goes here"/>
        </p>
        <p v-if="annualInterestRate" class="mb-3 flex justify-end align-center">
          <span class="flex nls-font-700 ml-5">
          {{ annualInterestRate }}
          <TooltipComponent content="Content goes here"/>
          </span>
        </p>
        <p class="mb-3 mt-[25px] flex justify-end align-center">
          $18,585.00
          <TooltipComponent content="Content goes here"/>
        </p>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary"
      v-on:click="modelValue.onNextClick"
    >
      {{ $t('message.lease') }}
    </button>
  </div>
</template>

<script lang="ts">
import CurrencyField from '@/components/CurrencyField.vue'
import { defineComponent, PropType } from 'vue'
import { useStore } from '@/store'
import { StringUtils } from '@/utils/StringUtils'
import { Price } from '@/store/modules/oracle/state'
import { assetsInfo } from '@/config/assetsInfo'
import { CurrencyUtils } from '@nolus/nolusjs'
import { Coin } from '@keplr-wallet/unit'

import TooltipComponent from '@/components/TooltipComponent.vue'
import { LeaseComponentProps } from '@/types/component/LeaseComponentProps'

export default defineComponent({
  name: 'LeaseFormComponent',
  components: {
    CurrencyField,
    TooltipComponent
  },
  props: {
    modelValue: {
      type: Object as PropType<LeaseComponentProps>,
      required: true
    }
  },
  data () {
    return {
      disabledInputField: true
    }
  },
  watch: {
    'modelValue.leaseApply' () {
      this.disabledInputField = !this.modelValue?.leaseApply
    }
  },
  computed: {
    annualInterestRate () {
      return this.modelValue?.leaseApply?.annual_interest_rate || ''
    },
    pricePerToken () {
      if (this.modelValue?.selectedCurrency?.balance.denom) {
        return this.getPrice(this.modelValue?.selectedCurrency?.balance.denom)
          .amount
      }
      return '0'
    },
    calculateLeaseAmount () {
      if (this.modelValue?.amount) {
        const leaseCurrency = this.modelValue?.selectedCurrency
        if (leaseCurrency) {
          return CurrencyUtils.calculateBalance(
            this.getPrice(leaseCurrency.balance.denom).amount,
            new Coin(
              leaseCurrency.balance.denom,
              this.modelValue?.amount as string
            ),
            0
          )
        }
      }

      return '0'
    }
  },
  methods: {
    getPrice (currencyDenom: string): Price {
      const prices = useStore().getters.getPrices
      const denom = StringUtils.getDenomFromMinimalDenom(currencyDenom)
      if (prices) {
        return prices[denom]
      }
      return {
        amount: '0',
        denom: ''
      }
    },
    formatAssetInfo (currencyDenom: string) {
      if (currencyDenom) {
        return assetsInfo[currencyDenom].coinAbbreviation
      }
      return ''
    }
  }
})
</script>
