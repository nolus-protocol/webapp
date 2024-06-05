<template>
  <!-- Leases -->
  <div
    v-if="TEMPLATES.opened == status"
    class="background border-standart shadow-box radius-medium radius-0-sm mt-6 pb-5 outline"
  >
    <div class="grid grid-cols-1 lg:grid-cols-8">
      <div class="border-standart border-b px-2 pb-5 pt-5 md:px-6 lg:col-span-3 lg:border-b-0 lg:border-r">
        <div
          v-if="leaseInfo.leaseData"
          class="pnl-container flex-1"
        >
          <div
            :class="[pnl.status ? 'success' : 'alert']"
            class="pnl nls-font-500 mr-2 flex cursor-pointer items-center whitespace-pre text-12"
            @click="pnlType = !pnlType"
          >
            <template v-if="pnl.status">
              <ArrowUp />
            </template>
            <template v-else>
              <ArrowDown />
            </template>
            &nbsp;{{ pnl.status ? "+" : "" }}<template v-if="!pnlType">{{ pnl.amount }}</template
            ><template v-else>{{ pnl.percent }}%</template>
          </div>
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon icon-share share flex text-primary"
            @click="onShare"
          ></button>
          <div
            v-if="isFreeInterest"
            class="interest-free nls-font-500 mr-2 flex cursor-pointer items-center whitespace-pre text-12"
          >
            {{ $t("message.free-interest") }}
            <TooltipComponent
              :content="$t('message.free-interest-tooltip')"
              class="!text-[#fff]"
            />
          </div>
        </div>
        <div class="my-4 flex">
          <img
            :src="getAssetIcon"
            class="m-0 mr-3 inline-block"
            height="36"
            width="36"
            @dblclick="copy"
          />
          <h1 class="nls-font-700 text-28 text-primary md:text-28">
            <CurrencyComponent
              :amount="amount"
              :decimals="asset?.decimal_digits"
              :denom="asset!.shortName"
              :font-size="22"
              :maxDecimals="6"
              :minimalDenom="asset!.ibcData"
              :type="CURRENCY_VIEW_TYPES.TOKEN"
            />
            <span class="nls-font-400 ml-1 inline-block text-20 uppercase text-primary"> </span>
          </h1>
        </div>
        <div class="flex flex-wrap whitespace-nowrap text-10 uppercase">
          <span
            v-if="leaseInfo.leaseData?.downPayment"
            class="data-label-info garet-medium m-1.5 mb-0 ml-0 rounded p-1 text-medium-blue"
          >
            {{ $t("message.down-payment") }}: ${{ downPayment }}
          </span>

          <span
            v-if="leaseInfo.leaseData?.price"
            class="data-label-info garet-medium m-1.5 mb-0 ml-0 rounded p-1 text-medium-blue"
          >
            {{ `${$t("message.price-per")} ${asset!.shortName}:` }} ${{ leaseInfo.leaseData?.price.toString(4) }}
          </span>
          <span class="data-label-info garet-medium m-1.5 mb-0 ml-0 rounded p-1 text-medium-blue">
            {{ $t("message.liq-trigger") }}: {{ liquidation }}
          </span>
        </div>
      </div>
      <div class="relative hidden px-2 pb-3 pt-3 md:block md:px-6 md:pb-0 md:pt-5 lg:col-span-5">
        <!-- Graph -->
        <div class="flex justify-between">
          <div>
            <span class="text-dark-grey">
              {{ $t("message.price") }}
            </span>
            <p class="text-primary">
              <b>
                <CurrencyComponent
                  :amount="currentPrice"
                  :decimals="4"
                  :font-size="20"
                  :font-size-small="14"
                  :hasSpace="false"
                  :isDenomInfront="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  denom="$"
                />
              </b>
            </p>
          </div>
          <div class="flex h-6 text-10">
            <button
              v-for="(value, index) in CHART_RANGES"
              :key="index"
              :class="`${value.label === chartTimeRange.label ? 'border-1 border-light-electric bg-[#0ea5e9]/10' : ''}`"
              class="chart-dates ml-2 w-10 justify-center rounded border"
              @click="
                chartTimeRange = value;
                loadCharts();
              "
            >
              {{ value.label }}
            </button>
          </div>
        </div>
        <div class="relaltive flex">
          <div class="relative hidden w-full md:block">
            <div v-if="leaseInfo.leaseData"></div>
            <PriceHistoryChart :chartData="chartData" />
          </div>
        </div>
      </div>
    </div>
    <div
      class="border-standart flex flex-col items-center justify-between border-t-[0px] px-2 pt-4 md:flex-row md:border-t-[1px] md:px-6"
    >
      <div class="flex w-full justify-around lg:w-auto">
        <div class="block">
          <p class="text-detail data-text m-0 flex items-center text-primary">
            {{ $t("message.outstanding-loan") }}
            <TooltipComponent :content="$t('message.outstanding-debt-tooltip')" />
          </p>
          <p class="nls-font-400 m-0 mt-1 text-20 text-primary">
            <span
              v-if="openedSubState"
              class="state-loading"
            >
            </span>
            <CurrencyComponent
              v-else
              :amount="leaseInfo.debt.toString()"
              :decimals="4"
              :font-size="20"
              :font-size-small="14"
              :hasSpace="false"
              :isDenomInfront="true"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              class="garet-medium"
              denom="$"
            />
          </p>
        </div>
        <div class="ml-8 block">
          <p class="text-detail data-text m-0 flex items-center text-primary">
            {{ $t("message.interest-fee") }}
            <TooltipComponent :content="$t('message.interest-fee-tooltip')" />
          </p>
          <p
            :class="{ 'line-throught': isFreeInterest }"
            class="nls-font-400 m-0 mt-1 text-20 text-primary"
          >
            <CurrencyComponent
              :amount="interest"
              :decimals="2"
              :font-size="20"
              :font-size-small="14"
              :hasSpace="false"
              :isDenomInfront="false"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              class="garet-medium"
              denom="%"
            />
          </p>
        </div>
        <div class="ml-8 block">
          <p class="text-detail data-text m-0 flex items-center text-primary">
            {{ $t("message.interest-due") }}
            <TooltipComponent :content="$t('message.repay-interest', { dueDate: interestDueDate })" />
          </p>
          <p class="nls-font-400 m-0 flex items-baseline text-20 text-primary">
            <span
              v-if="openedSubState"
              class="state-loading"
            >
            </span>
            <CurrencyComponent
              v-else
              :amount="interestDue"
              :class="{ 'text-yellow': interestDueStatus }"
              :decimals="4"
              :font-size="20"
              :font-size-small="14"
              :hasSpace="false"
              :isDenomInfront="true"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              class="garet-medium mt-1"
              denom="$"
            />
            <TooltipComponent
              v-if="interestDueStatus && !openedSubState"
              :content="$t('message.repay-interest', { dueDate: interestDueDate })"
              class="text-yellow"
            />
          </p>
        </div>
      </div>
      <div class="flex w-full md:block md:w-auto">
        <button
          v-if="leaseInfo.leaseStatus.opened"
          :class="{ 'js-loading': loadingRepay }"
          :disabled="openedSubState"
          class="btn btn-secondary btn-large-secondary mt-4 w-full md:mt-0 md:w-auto"
          @click="showRepayModal = true"
        >
          {{ $t("message.repay") }}
        </button>
        <button
          v-if="leaseInfo.leaseStatus.opened"
          :class="{ 'js-loading': loadingClose }"
          :disabled="openedSubState"
          class="btn btn-primary btn-large-primary ml-[12px] mt-4 w-full md:mt-0 md:w-auto"
          @click="showCloseModal = true"
        >
          {{ $t("message.close") }}
        </button>
      </div>
    </div>
  </div>

  <LeaseNew
    v-if="TEMPLATES.opened == status"
    class="mt-6"
    v-bind="leaseOpened"
    @on-share="onShare"
  >
    <template #chart>
      <div class="flex justify-between">
        <div>
          <span class="text-dark-grey">
            {{ $t("message.price") }}
          </span>
          <p class="text-primary">
            <b>
              <CurrencyComponent
                :amount="currentPrice"
                :decimals="4"
                :font-size="20"
                :font-size-small="14"
                :hasSpace="false"
                :isDenomInfront="true"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                denom="$"
              />
            </b>
          </p>
        </div>
        <div class="flex h-6 text-10">
          <button
            v-for="(value, index) in CHART_RANGES"
            :key="index"
            :class="`${value.label === chartTimeRange.label ? 'border-1 border-light-electric bg-[#0ea5e9]/10' : ''}`"
            class="chart-dates ml-2 w-10 justify-center rounded border"
            @click="
              chartTimeRange = value;
              loadCharts();
            "
          >
            {{ value.label }}
          </button>
        </div>
      </div>
      <div class="relaltive flex">
        <div class="relative hidden w-full md:block">
          <div v-if="leaseInfo.leaseData"></div>
          <PriceHistoryChart
            :chartData="chartData"
            class="max-h-[100px]"
          />
        </div>
      </div>
    </template>
    <template #size>
      <div class="my-4 flex">
        <img
          :src="getAssetIcon"
          class="m-0 mr-3 inline-block"
          height="36"
          width="36"
          @dblclick="copy"
        />
        <h1 class="nls-font-700 text-28 text-primary md:text-28">
          <CurrencyComponent
            :amount="amount"
            :decimals="asset?.decimal_digits"
            :denom="asset!.shortName"
            :font-size="22"
            :maxDecimals="6"
            :minimalDenom="asset!.ibcData"
            :type="CURRENCY_VIEW_TYPES.TOKEN"
          />
          <span class="nls-font-400 ml-1 inline-block text-20 uppercase text-primary"> </span>
        </h1>
      </div>
      <div class="flex flex-wrap whitespace-nowrap text-10 uppercase">
        <span
          v-if="leaseInfo.leaseData?.downPayment"
          class="data-label-info garet-medium m-1.5 mb-0 ml-0 rounded p-1 text-medium-blue"
        >
          {{ $t("message.down-payment") }}: ${{ downPayment }}
        </span>

        <span
          v-if="leaseInfo.leaseData?.price"
          class="data-label-info garet-medium m-1.5 mb-0 ml-0 rounded p-1 text-medium-blue"
        >
          {{ `${$t("message.price-per")} ${asset!.shortName}:` }} ${{ leaseInfo.leaseData?.price.toString(4) }}
        </span>
        <span class="data-label-info garet-medium m-1.5 mb-0 ml-0 rounded p-1 text-medium-blue">
          {{ $t("message.liq-trigger") }}: {{ liquidation }}
        </span>
      </div>
    </template>
    <template #debt-1>
      <CurrencyComponent
        :amount="leaseInfo.debt.toString()"
        :decimals="4"
        :font-size="20"
        :font-size-small="14"
        :hasSpace="false"
        :isDenomInfront="true"
        :type="CURRENCY_VIEW_TYPES.CURRENCY"
        class="garet-medium"
        denom="$"
      />
    </template>
    <template #interest-0>
      <CurrencyComponent
        :amount="interest"
        :decimals="2"
        :font-size="20"
        :font-size-small="14"
        :hasSpace="false"
        :isDenomInfront="false"
        :type="CURRENCY_VIEW_TYPES.CURRENCY"
        class="garet-medium"
        denom="%"
      />
    </template>
    <template #interest-1>
      <CurrencyComponent
        :amount="interestDue"
        :class="{ 'text-yellow': interestDueStatus }"
        :decimals="4"
        :font-size="20"
        :font-size-small="14"
        :hasSpace="false"
        :isDenomInfront="true"
        :type="CURRENCY_VIEW_TYPES.CURRENCY"
        class="garet-medium mt-1"
        denom="$"
      />
    </template>
  </LeaseNew>

  <LeaseNew
    v-if="TEMPLATES.paid == status"
    class="mt-6"
    v-bind="leaseOpened"
    @on-share="onShare"
  >
    <template #chart>
      <div class="flex justify-between">
        <div>
          <span class="text-dark-grey">
            {{ $t("message.price") }}
          </span>
          <p class="text-primary">
            <b>
              <CurrencyComponent
                :amount="currentPrice"
                :decimals="4"
                :font-size="20"
                :font-size-small="14"
                :hasSpace="false"
                :isDenomInfront="true"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                denom="$"
              />
            </b>
          </p>
        </div>
        <div class="flex h-6 text-10">
          <button
            v-for="(value, index) in CHART_RANGES"
            :key="index"
            :class="`${value.label === chartTimeRange.label ? 'border-1 border-light-electric bg-[#0ea5e9]/10' : ''}`"
            class="chart-dates ml-2 w-10 justify-center rounded border"
            @click="
              chartTimeRange = value;
              loadCharts();
            "
          >
            {{ value.label }}
          </button>
        </div>
      </div>
      <div class="relaltive flex">
        <div class="relative hidden w-full md:block">
          <div v-if="leaseInfo.leaseData"></div>
          <PriceHistoryChart
            :chartData="chartData"
            class="max-h-[100px]"
          />
        </div>
      </div>
    </template>
    <template #size>
      <div class="my-4 flex">
        <img
          :src="getAssetIcon"
          class="m-0 mr-3 inline-block"
          height="36"
          width="36"
          @dblclick="copy"
        />
        <h1 class="nls-font-700 text-28 text-primary md:text-28">
          <CurrencyComponent
            :amount="amount"
            :decimals="asset?.decimal_digits"
            :denom="asset!.shortName"
            :font-size="22"
            :maxDecimals="6"
            :minimalDenom="asset!.ibcData"
            :type="CURRENCY_VIEW_TYPES.TOKEN"
          />
          <span class="nls-font-400 ml-1 inline-block text-20 uppercase text-primary"> </span>
        </h1>
      </div>
      <div class="flex flex-wrap whitespace-nowrap text-10 uppercase">
        <span
          v-if="leaseInfo.leaseData?.downPayment"
          class="data-label-info garet-medium m-1.5 mb-0 ml-0 rounded p-1 text-medium-blue"
        >
          {{ $t("message.down-payment") }}: ${{ downPayment }}
        </span>

        <span
          v-if="leaseInfo.leaseData?.price"
          class="data-label-info garet-medium m-1.5 mb-0 ml-0 rounded p-1 text-medium-blue"
        >
          {{ `${$t("message.price-per")} ${asset!.shortName}:` }} ${{ leaseInfo.leaseData?.price.toString(4) }}
        </span>
        <span class="data-label-info garet-medium m-1.5 mb-0 ml-0 rounded p-1 text-medium-blue">
          {{ $t("message.liq-trigger") }}: {{ liquidation }}
        </span>
      </div>
    </template>
    <template #debt-1>
      <CurrencyComponent
        :amount="leaseInfo.debt.toString()"
        :decimals="4"
        :font-size="20"
        :font-size-small="14"
        :hasSpace="false"
        :isDenomInfront="true"
        :type="CURRENCY_VIEW_TYPES.CURRENCY"
        class="garet-medium"
        denom="$"
      />
    </template>
    <template #interest-0>
      <CurrencyComponent
        :amount="interest"
        :decimals="2"
        :font-size="20"
        :font-size-small="14"
        :hasSpace="false"
        :isDenomInfront="false"
        :type="CURRENCY_VIEW_TYPES.CURRENCY"
        class="garet-medium"
        denom="%"
      />
    </template>
    <template #interest-1>
      <CurrencyComponent
        :amount="interestDue"
        :class="{ 'text-yellow': interestDueStatus }"
        :decimals="4"
        :font-size="20"
        :font-size-small="14"
        :hasSpace="false"
        :isDenomInfront="true"
        :type="CURRENCY_VIEW_TYPES.CURRENCY"
        class="garet-medium mt-1"
        denom="$"
      />
    </template>
  </LeaseNew>

  <LeaseNew
    v-if="TEMPLATES.opening == status"
    class="mt-6"
    v-bind="leaseOpened"
    @on-share="onShare"
  >
    <template #chart>
      <div class="flex justify-between">
        <div>
          <span class="text-dark-grey">
            {{ $t("message.price") }}
          </span>
          <p class="text-primary">
            <b>
              <CurrencyComponent
                :amount="currentPrice"
                :decimals="4"
                :font-size="20"
                :font-size-small="14"
                :hasSpace="false"
                :isDenomInfront="true"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                denom="$"
              />
            </b>
          </p>
        </div>
        <div class="flex h-6 text-10">
          <button
            v-for="(value, index) in CHART_RANGES"
            :key="index"
            :class="`${value.label === chartTimeRange.label ? 'border-1 border-light-electric bg-[#0ea5e9]/10' : ''}`"
            class="chart-dates ml-2 w-10 justify-center rounded border"
            @click="
              chartTimeRange = value;
              loadCharts();
            "
          >
            {{ value.label }}
          </button>
        </div>
      </div>
      <div class="relaltive flex">
        <div class="relative hidden w-full md:block">
          <div v-if="leaseInfo.leaseData"></div>
          <PriceHistoryChart
            :chartData="chartData"
            class="max-h-[100px]"
          />
        </div>
      </div>
    </template>
    <template #size>
      <div class="my-4 flex">
        <img
          :src="getAssetIcon"
          class="m-0 mr-3 inline-block"
          height="36"
          width="36"
          @dblclick="copy"
        />
        <h1 class="nls-font-700 text-28 text-primary md:text-28">
          <CurrencyComponent
            :amount="amount"
            :decimals="asset?.decimal_digits"
            :denom="asset!.shortName"
            :font-size="22"
            :maxDecimals="6"
            :minimalDenom="asset!.ibcData"
            :type="CURRENCY_VIEW_TYPES.TOKEN"
          />
          <span class="nls-font-400 ml-1 inline-block text-20 uppercase text-primary"> </span>
        </h1>
      </div>
      <div class="flex flex-wrap whitespace-nowrap text-10 uppercase">
        <span
          v-if="leaseInfo.leaseData?.downPayment"
          class="data-label-info garet-medium m-1.5 mb-0 ml-0 rounded p-1 text-medium-blue"
        >
          {{ $t("message.down-payment") }}: ${{ downPayment }}
        </span>

        <span
          v-if="leaseInfo.leaseData?.price"
          class="data-label-info garet-medium m-1.5 mb-0 ml-0 rounded p-1 text-medium-blue"
        >
          {{ `${$t("message.price-per")} ${asset!.shortName}:` }} ${{ leaseInfo.leaseData?.price.toString(4) }}
        </span>
        <span class="data-label-info garet-medium m-1.5 mb-0 ml-0 rounded p-1 text-medium-blue">
          {{ $t("message.liq-trigger") }}: {{ liquidation }}
        </span>
      </div>
    </template>
    <template #debt-1>
      <CurrencyComponent
        :amount="leaseInfo.debt.toString()"
        :decimals="4"
        :font-size="20"
        :font-size-small="14"
        :hasSpace="false"
        :isDenomInfront="true"
        :type="CURRENCY_VIEW_TYPES.CURRENCY"
        class="garet-medium"
        denom="$"
      />
    </template>
    <template #interest-0>
      <CurrencyComponent
        :amount="interest"
        :decimals="2"
        :font-size="20"
        :font-size-small="14"
        :hasSpace="false"
        :isDenomInfront="false"
        :type="CURRENCY_VIEW_TYPES.CURRENCY"
        class="garet-medium"
        denom="%"
      />
    </template>
    <template #interest-1>
      <CurrencyComponent
        :amount="interestDue"
        :class="{ 'text-yellow': interestDueStatus }"
        :decimals="4"
        :font-size="20"
        :font-size-small="14"
        :hasSpace="false"
        :isDenomInfront="true"
        :type="CURRENCY_VIEW_TYPES.CURRENCY"
        class="garet-medium mt-1"
        denom="$"
      />
    </template>
  </LeaseNew>

  <div
    v-if="TEMPLATES.opening == status"
    class="background border-standart shadow-box mt-6 outline lg:rounded-xl"
  >
    <div class="grid grid-cols-1 lg:grid-cols-8">
      <div
        class="border-standart flex flex-col justify-between border-b p-4 lg:col-span-3 lg:border-b-0 lg:border-r lg:p-6"
      >
        <div
          v-if="leaseInfo.leaseData"
          class="pnl-container"
        >
          <div class="pnl nls-font-500 grey mr-2 whitespace-pre text-12">{{ $t("message.pnl") }} $0.00</div>
        </div>
        <div class="flex flex-col">
          <h1 class="nls-font-700 text-28 text-primary md:text-28">
            {{ $t("message.opening") }}
          </h1>
        </div>
        <div class="relative">
          <div class="state flex pt-4 md:pt-0">
            <div class="status state-background relative cursor-pointer">
              <div class="state-status garet-medium">
                {{ $t("message.opening-channel") }}
              </div>
              <OpenChannel
                :class="openingSubState?.channel"
                :height="16"
                :width="16"
              />
            </div>
            <div class="status relative mx-4 cursor-pointer">
              <div class="state-status garet-medium">
                {{ $t("message.transferring-assets") }}
              </div>
              <Transfer
                :class="openingSubState?.transfer"
                :height="16"
                :width="16"
              />
            </div>
            <div class="status relative cursor-pointer">
              <div class="state-status garet-medium">
                {{ $t("message.swapping-assets") }}
              </div>
              <Swap
                :class="openingSubState?.swap"
                :height="16"
                :width="16"
              />
            </div>
          </div>
        </div>
      </div>
      <div class="relative hidden px-2 pb-3 pt-3 md:block md:px-6 md:pb-5 md:pt-5 lg:col-span-5">
        <!-- Graph -->

        <div class="flex justify-between">
          <div>
            <span class="text-dark-grey">
              {{ $t("message.price") }}
            </span>
            <p class="text-primary">
              <b>
                <CurrencyComponent
                  :amount="currentPrice"
                  :font-size="20"
                  :font-size-small="14"
                  :hasSpace="false"
                  :isDenomInfront="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  denom="$"
                />
              </b>
            </p>
          </div>
          <div class="flex h-6 text-10">
            <button
              v-for="(value, index) in CHART_RANGES"
              :key="index"
              :class="`${value.label === chartTimeRange.label ? 'border-1 border-light-electric bg-[#0ea5e9]/10' : ''}`"
              class="chart-dates ml-2 w-10 justify-center rounded border"
              @click="
                chartTimeRange = value;
                loadCharts();
              "
            >
              {{ value.label }}
            </button>
          </div>
        </div>
        <div class="relaltive flex">
          <div class="relative hidden w-full md:block">
            <Chart :chartData="chartData" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="TEMPLATES.paid == status"
    class="background border-standart shadow-box radius-medium radius-0-sm mt-6 pb-5 outline"
  >
    <div class="grid grid-cols-1 lg:grid-cols-8">
      <div class="border-standart border-b px-6 pb-5 pt-5 lg:col-span-3 lg:border-b-0 lg:border-r">
        <div
          v-if="leaseInfo.leaseData"
          class="pnl-container"
        >
          <div
            :class="[pnl.status ? 'success' : 'alert']"
            class="pnl nls-font-500 mr-2 flex cursor-pointer items-center whitespace-pre text-12"
            @click="pnlType = !pnlType"
          >
            <template v-if="pnl.status">
              <ArrowUp />
            </template>
            <template v-else>
              <ArrowDown />
            </template>
            &nbsp;{{ pnl.status ? "+" : "" }}<template v-if="!pnlType">{{ pnl.amount }}</template
            ><template v-else>{{ pnl.percent }}%</template>
          </div>
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon icon-share share flex text-primary"
            @click="onShare"
          ></button>
          <div
            v-if="isFreeInterest"
            class="interest-free nls-font-500 mr-2 flex cursor-pointer items-center whitespace-pre text-12"
          >
            {{ $t("message.free-interest") }}
            <TooltipComponent
              :content="$t('message.free-interest-tooltip')"
              class="!text-[#fff]"
            />
          </div>
        </div>

        <div class="my-4 flex flex-col">
          <div class="flex">
            <img
              :src="getAssetIcon"
              class="m-0 mr-3 inline-block"
              height="36"
              width="36"
              @dblclick="copy"
            />
            <h1 class="nls-font-700 text-28 text-primary md:text-28">
              <CurrencyComponent
                :amount="amount"
                :decimals="asset?.decimal_digits"
                :denom="asset!.shortName"
                :font-size="22"
                :maxDecimals="6"
                :minimalDenom="asset!.ibcData"
                :type="CURRENCY_VIEW_TYPES.TOKEN"
              />
              <span class="nls-font-400 ml-1 inline-block text-20 uppercase text-primary"> </span>
            </h1>
          </div>
          <div
            v-for="b of leaseInfo.balances"
            :key="b.icon"
            class="mt-[12px] flex"
          >
            <img
              :src="b.icon"
              class="m-0 mr-3 inline-block"
              height="36"
              width="36"
            />
            <h1 class="nls-font-700 text-28 text-primary md:text-28">
              <CurrencyComponent
                :amount="b.amount"
                :decimals="Number(b.decimals)"
                :denom="b.shortName"
                :font-size="22"
                :maxDecimals="6"
                :type="CURRENCY_VIEW_TYPES.TOKEN"
              />
              <span class="nls-font-400 ml-1 inline-block text-20 uppercase text-primary"> </span>
            </h1>
          </div>
        </div>
      </div>
      <div class="relative hidden px-2 pb-3 pt-3 md:block md:px-6 md:pb-0 md:pt-5 lg:col-span-5">
        <!-- Graph -->
        <div class="flex justify-between">
          <div>
            <span class="text-dark-grey">
              {{ $t("message.price") }}
            </span>
            <p class="text-primary">
              <b>
                <CurrencyComponent
                  :amount="currentPrice"
                  :font-size="20"
                  :font-size-small="14"
                  :hasSpace="false"
                  :isDenomInfront="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  denom="$"
                />
              </b>
            </p>
          </div>
          <div class="flex h-6 text-10">
            <button
              v-for="(value, index) in CHART_RANGES"
              :key="index"
              :class="`${value.label === chartTimeRange.label ? 'border-1 border-light-electric bg-[#0ea5e9]/10' : ''}`"
              class="chart-dates ml-2 w-10 justify-center rounded border"
              @click="
                chartTimeRange = value;
                loadCharts();
              "
            >
              {{ value.label }}
            </button>
          </div>
        </div>
        <div class="relaltive flex">
          <div class="relative hidden w-full md:block">
            <PriceHistoryChart :chartData="chartData" />
          </div>
        </div>
      </div>
    </div>
    <div
      class="border-standart flex flex-col items-center justify-between border-t-[0px] px-2 pt-4 md:flex-row md:border-t-[1px] md:px-6"
    >
      <div class="flex"></div>
      <button
        :class="{ 'js-loading': leaseInfo.leaseStatus?.paid?.in_progress }"
        class="btn btn-secondary btn-large-secondary mt-4 w-full md:mt-0 md:w-auto"
        @click="onShowClaimDialog"
      >
        {{ $t("message.collect") }}
      </button>
    </div>
  </div>
  <Modal
    v-if="showClaimDialog"
    ref="claimDialog"
    route="claim"
    @close-modal="showClaimDialog = false"
  >
    <DialogHeader :headerList="[$t('message.close-lease')]">
      <ConfirmComponent
        :amount="state.amount"
        :fee="state.fee"
        :onBackClick="onConfirmBackClick"
        :onOkClick="onClickOkBtn"
        :onSendClick="onSendClick"
        :receiverAddress="state.receiverAddress"
        :selectedCurrency="state.selectedCurrency"
        :step="step"
        :txHash="state.txHash"
        :txType="$t(`message.${TxType.TRANSFER}`)"
      />
    </DialogHeader>
  </Modal>

  <Modal
    v-if="showRepayModal"
    route="repay"
    @close-modal="showRepayModal = false"
  >
    <RepayDialog :lease-info="leaseInfo" />
  </Modal>

  <Modal
    v-if="showCloseModal"
    route="market-close"
    @close-modal="showCloseModal = false"
  >
    <MarketCloseDialog :lease-info="leaseInfo" />
  </Modal>

  <Modal
    v-if="showShareDialog"
    route="share"
    @close-modal="showShareDialog = false"
  >
    <ShareDialog
      :asset="asset!.shortName"
      :icon="getAssetIcon"
      :position="pnl.percent"
      :price="leaseInfo.leaseData?.price!.toString(6) ?? '0'"
    />
  </Modal>
</template>

<script lang="ts" setup>
import { Lease as LeaseNew, LeasePnlStatus, type LeaseProps } from "web-components";
import type { LeaseData } from "@/common/types";
import { CONFIRM_STEP, CURRENCY_VIEW_TYPES, TxType } from "@/common/types";

import RepayDialog from "@/common/components/modals/RepayDialog.vue";
import MarketCloseDialog from "@/common/components/modals/MarketCloseDialog.vue";

import Modal from "@/common/components/modals/templates/Modal.vue";
import TooltipComponent from "@/common/components/TooltipComponent.vue";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";
import ConfirmComponent from "@/common/components/modals/templates/ConfirmComponent.vue";
import DialogHeader from "@/common/components/modals/templates/DialogHeader.vue";
import ShareDialog from "@/common/components/modals/ShareDialog.vue";

import OpenChannel from "@/common/components/icons/OpenChannel.vue";
import Transfer from "@/common/components/icons/Transfer.vue";
import Swap from "@/common/components/icons/Swap.vue";
import ArrowUp from "@/common/components/icons/ArrowUp.vue";
import ArrowDown from "@/common/components/icons/ArrowDown.vue";

import { computed, inject, onMounted, type PropType, ref } from "vue";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Dec } from "@keplr-wallet/unit";
import { CHART_RANGES, CoinGecko, GAS_FEES, LEASE_DUE, NATIVE_ASSET, TIP } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { useOracleStore } from "@/common/stores/oracle";
import { useI18n } from "vue-i18n";
import { AppUtils, AssetUtils, datePraser, Logger, StringUtils, WalletManager, walletOperation } from "@/common/utils";
import { coin } from "@cosmjs/amino";
import { useApplicationStore } from "@/common/stores/application";
import { Chart, PriceHistoryChart } from "./";

import {
  type BuyAssetOngoingState,
  Lease,
  type PaidLeaseInfo,
  type TransferOutOngoingState
} from "@nolus/nolusjs/build/contracts";

enum TEMPLATES {
  "opening",
  "opened",
  "paid",
  "closed",
  "repayment"
}

const OPENING_CHANNEL = "open_ica_account";
const props = defineProps({
  leaseInfo: {
    type: Object as PropType<LeaseData | any>,
    required: true
  }
});

const showRepayModal = ref(false);
const showCloseModal = ref(false);
const chartTimeRange = ref(CHART_RANGES["1"]);
const i18n = useI18n();
const chartData = ref();
const showClaimDialog = ref(false);
const walletStore = useWalletStore();
const oracleStore = useOracleStore();
const app = useApplicationStore();

const getLeases = inject("getLeases", () => {});
const claimDialog = ref();
const pnlType = ref(false);
const showShareDialog = ref(false);
const isFreeInterest = ref(false);

const step = ref(CONFIRM_STEP.CONFIRM);
const state = ref({
  selectedCurrency: {
    balance: { amount: 0, denom: "" }
  },
  receiverAddress: WalletManager.getWalletAddress(),
  amount: "",
  memo: "",
  txHash: "",
  fee: coin(GAS_FEES.close_lease + TIP.amount, NATIVE_ASSET.denom)
});

onMounted(() => {
  loadCharts();
  setFreeInterest();
});

async function setFreeInterest() {
  const data = await AppUtils.getFreeInterestAddress();
  for (const item of data.interest_paid_to) {
    if (item == props.leaseInfo.leaseAddress) {
      isFreeInterest.value = true;
      break;
    }
  }
}

async function loadCharts() {
  const { days, interval } = chartTimeRange.value;
  const pricesData = await fetchChartData(days, interval);

  chartData.value = {
    datasets: [
      {
        label: i18n.t("message.chart-tooltip-price"),
        borderColor: "#2868E1",
        data: pricesData,
        tension: 0.4,
        pointRadius: 0
      }
    ]
  };
}

const currentPrice = computed(() => {
  if (props.leaseInfo.leaseStatus?.opening && props.leaseInfo.leaseData) {
    const item = app.currenciesData?.[props.leaseInfo.leaseData?.leasePositionTicker as string];
    return oracleStore.prices[item?.ibcData as string]?.amount ?? "0";
  }

  const ticker =
    props.leaseInfo.leaseStatus?.opened?.amount.ticker ||
    props.leaseInfo.leaseStatus?.paid?.amount.ticker ||
    props.leaseInfo.leaseStatus?.opening?.downpayment.ticker;

  const item = AssetUtils.getCurrencyByTicker(ticker as string);
  return oracleStore.prices[item!.ibcData as string]?.amount ?? "0";
});

async function fetchChartData(days: string, interval: string) {
  let coinGeckoId = asset.value?.coingeckoId;

  if (props.leaseInfo.leaseStatus?.opening && !props.leaseInfo.leaseData) {
    const ticker =
      props.leaseInfo.leaseStatus?.opened?.amount.ticker ||
      props.leaseInfo.leaseStatus?.opening?.downpayment.ticker ||
      props.leaseInfo.leaseStatus?.paid?.amount.ticker;

    const item = AssetUtils.getCurrencyByTicker(ticker);
    const asset = AssetUtils.getCurrencyByDenom(item?.ibcData as string);
    coinGeckoId = asset.coingeckoId;
  }

  const res = await fetch(
    `${CoinGecko.url}/coins/${coinGeckoId}/market_chart?vs_currency=usd&days=${days}&interval=${interval}&x_cg_pro_api_key=${CoinGecko.key}`
  );
  const { prices } = await res.json();
  return prices;
}

const asset = computed(() => {
  if (props.leaseInfo.leaseStatus?.opening && props.leaseInfo.leaseData) {
    const item = app.currenciesData?.[props.leaseInfo.leaseData?.leasePositionTicker as string];
    return item;
  }

  const ticker =
    props.leaseInfo.leaseStatus?.opened?.amount.ticker ||
    props.leaseInfo.leaseStatus?.paid?.amount.ticker ||
    props.leaseInfo.leaseStatus?.opening?.downpayment.ticker;
  const item = AssetUtils.getCurrencyByTicker(ticker as string);

  const asset = AssetUtils.getCurrencyByDenom(item?.ibcData as string);
  return asset;
});

const getAssetIcon = computed((): string => {
  if (props.leaseInfo.leaseStatus?.opening && props.leaseInfo.leaseData) {
    const item = app.currenciesData?.[props.leaseInfo.leaseData?.leasePositionTicker as string];
    return app.assetIcons?.[item!.key as string] as string;
  }

  const ticker =
    props.leaseInfo.leaseStatus?.opened?.amount.ticker ||
    props.leaseInfo.leaseStatus?.opening?.downpayment.ticker ||
    props.leaseInfo.leaseStatus?.paid?.amount.ticker ||
    "";
  return app.assetIcons?.[`${ticker}@${props.leaseInfo.protocol}`] as string;
});

const downPayment = computed(() => {
  const fee = props.leaseInfo.leaseData?.downPaymentFee as Dec;
  const amount = props.leaseInfo.leaseData?.downPayment.sub(fee);
  return amount?.toString(2);
});

const amount = computed(() => {
  const data =
    props.leaseInfo.leaseStatus?.opened?.amount ||
    props.leaseInfo.leaseStatus.opening?.downpayment ||
    props.leaseInfo.leaseStatus.paid?.amount;
  return data?.amount ?? "0";
});

const interestDue = computed(() => {
  const data = props.leaseInfo.leaseStatus?.opened;

  if (data) {
    const item = AssetUtils.getCurrencyByTicker(data.due_interest.ticker);

    const token = CurrencyUtils.convertMinimalDenomToDenom(
      props.leaseInfo.interestDue.truncate().toString(),
      item.ibcData,
      item!.symbol,
      Number(item!.decimal_digits)
    );
    return token.toDec().toString();
  }

  return "0";
});

const interest = computed(() => {
  return props.leaseInfo.interest.toString(2);
});

const status = computed(() => {
  if (props.leaseInfo.leaseStatus.opening) {
    return TEMPLATES.opening;
  }

  if (props.leaseInfo.leaseStatus.opened) {
    return TEMPLATES.opened;
  }

  if (props.leaseInfo.leaseStatus.paid) {
    return TEMPLATES.paid;
  }

  return null;
});

function onShowClaimDialog() {
  const data = props.leaseInfo.leaseStatus.paid as PaidLeaseInfo;
  if (data) showClaimDialog.value = true;

  const item = AssetUtils.getCurrencyByTicker(data.amount.ticker!);
  const token = CurrencyUtils.convertMinimalDenomToDenom(
    data.amount.amount,
    item.ibcData,
    item!.symbol,
    Number(item!.decimal_digits)
  );

  state.value.amount = token.toDec().toString() ?? "0";
  state.value.selectedCurrency = {
    balance: {
      amount: 0,
      denom: item.ibcData
    }
  };
}

async function onClaim() {
  const data = props.leaseInfo.leaseStatus.paid;
  if (data) {
    try {
      const wallet = walletStore.wallet as NolusWallet;

      step.value = CONFIRM_STEP.PENDING;

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, props.leaseInfo.leaseAddress);

      const funds = [
        {
          denom: TIP.denom,
          amount: TIP.amount.toString()
        }
      ];

      const { txHash, txBytes, usedFee } = await leaseClient.simulateCloseLeaseTx(wallet, funds);

      state.value.txHash = txHash;

      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }

      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;

      getLeases();
    } catch (e) {
      Logger.error(e);
      step.value = CONFIRM_STEP.ERROR;
    }
  }
}

async function onSendClick() {
  try {
    await walletOperation(onClaim);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

function onConfirmBackClick() {
  const close = claimDialog.value?.onModalClose;
  if (close) {
    close();
  }
  showClaimDialog.value = false;
}

function onClickOkBtn() {
  const close = claimDialog.value?.onModalClose;
  if (close) {
    close();
  }
  showClaimDialog.value = false;
  step.value = CONFIRM_STEP.CONFIRM;
}

const liquidation = computed(() => {
  const lease = props.leaseInfo.leaseStatus.opened;
  if (lease) {
    return `$${props.leaseInfo.liquidation.toString(4)}`;
  }
  return "$0";
});

const pnl = computed(() => {
  const lease = props.leaseInfo.leaseStatus.opened ?? props.leaseInfo.leaseStatus.paid;
  if (lease) {
    return {
      percent: props.leaseInfo.pnlPercent.toString(2),
      amount: CurrencyUtils.formatPrice(props.leaseInfo.pnlAmount.toString()),
      status: props.leaseInfo.pnlAmount.isPositive()
    };
  }

  return {
    percent: "0",
    amount: "0",
    status: false
  };
});

const copy = () => {
  StringUtils.copyToClipboard(props.leaseInfo.leaseAddress);
};

const openingSubState = computed(() => {
  const data = props.leaseInfo.leaseStatus.opening;
  if (OPENING_CHANNEL == data?.in_progress) {
    return {
      channel: ["current"],
      transfer: [],
      swap: []
    };
  }

  const state = data?.in_progress as TransferOutOngoingState | BuyAssetOngoingState;

  if ((state as TransferOutOngoingState).transfer_out) {
    return {
      channel: ["ready"],
      transfer: ["current"],
      swap: []
    };
  }

  if ((state as BuyAssetOngoingState).buy_asset) {
    return {
      channel: ["ready"],
      transfer: ["ready"],
      swap: ["current"]
    };
  }

  return {
    channel: [],
    transfer: [],
    swap: []
  };
});

const openedSubState = computed(() => {
  const data = props.leaseInfo.leaseStatus.opened;
  if (data?.in_progress != null) {
    return true;
  }

  return false;
});

const loadingRepay = computed(() => {
  const data = props.leaseInfo.leaseStatus.opened;

  if (Object.prototype.hasOwnProperty.call(data?.in_progress ?? {}, "repayment")) {
    return true;
  }

  return false;
});

const loadingClose = computed(() => {
  const data = props.leaseInfo.leaseStatus.opened;

  if (Object.prototype.hasOwnProperty.call(data?.in_progress ?? {}, "close")) {
    return true;
  }

  return false;
});

const interestDueStatus = computed(() => {
  const lease = props.leaseInfo.leaseStatus?.opened;
  if (lease) {
    const isDue = new Dec(LEASE_DUE).gte(new Dec(lease.overdue_collect_in));
    if (isDue) {
      return true;
    }
    return false;
  }
  return false;
});

const interestDueDate = computed(() => {
  const lease = props.leaseInfo.leaseStatus?.opened;
  let date = new Date();
  if (lease) {
    date = new Date(date.getTime() + lease.overdue_collect_in / 1000 / 1000);
  }
  return datePraser(date.toISOString());
});

async function onShare() {
  showShareDialog.value = true;
}

// <button
//   v-if="leaseInfo.leaseStatus.opened"
//   :class="{ 'js-loading': loadingRepay }"
// :disabled="openedSubState"
// class="btn btn-secondary btn-large-secondary mt-4 w-full md:mt-0 md:w-auto"
// @click="showRepayModal = true"
//   >
//   {{ $t("message.repay") }}
// </button>
// <button
// v-if="leaseInfo.leaseStatus.opened"
//   :class="{ 'js-loading': loadingClose }"
// :disabled="openedSubState"
// class="btn btn-primary btn-large-primary ml-[12px] mt-4 w-full md:mt-0 md:w-auto"
// @click="showCloseModal = true"
//   >
//   {{ $t("message.close") }}
// </button>

const leaseOpened = computed<LeaseProps>(() => ({
  title: "Buy position",
  share: {
    label: "Share Position"
  },
  status: status.value,
  tabs: [
    { button: { icon: "icon-assets" }, content: "Some content 1", name: "chart" },
    { button: { icon: "icon-assets" }, content: "Some content 2", name: "size" },
    { button: { icon: "icon-assets" }, content: "Some content 3", name: "test" }
  ],
  actionButtons: {
    repay: { label: "Repay", loading: loadingRepay.value },
    close: { label: "Close", loading: loadingClose.value },
    collect: { label: "Collect" }
  },
  progressBarTitle: "Health",
  progressDateTitle: "Opened on",
  progressDate: "FEB. 8, 2024",
  margin: 66,
  pnl: {
    click() {
      pnlType.value = !pnlType.value;
    },
    value: pnl.value.status ? `+${pnl.value.amount}` : !pnlType.value ? `${pnl.value.amount}` : `${pnl.value.percent}%`,
    status: pnl.value.status ? LeasePnlStatus.POSITIVE : LeasePnlStatus.NEGATIVE
  },
  debt: {
    title: i18n.t("message.outstanding-loan"),
    tooltip: i18n.t("message.outstanding-debt-tooltip")
  },
  interest: {
    title: i18n.t("message.interest-fee"),
    tooltip: i18n.t("message.interest-fee-tooltip")
  },
  interestDue: {
    title: i18n.t("message.interest-due"),
    tooltip: i18n.t("message.repay-interest", { dueDate: interestDueDate.value }),
    class: "text-warning-100"
  }
}));

// {{ pnl.status ? "+" : "" }}<template v-if="!pnlType">{{ pnl.amount }}</template
// ><template v-else>{{ pnl.percent }}%</template>
</script>
<style lang="scss">
button.share {
  padding: 6px 6px 6px 4px !important;
  font-size: 1.1rem !important;
}

div.interest-free {
  background-color: rgb(255, 185, 34);
  color: white;
  margin-left: 8px;
  display: flex;
  padding: 6px;
  border-radius: 4px;
}
</style>
