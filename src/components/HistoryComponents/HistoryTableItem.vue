<template>
  <div class="history-item">
    <div
      v-for="(msg, index) in transaction.msgs"
      :key="index"
      class="md:grid md:grid-cols-12 pt-3 gap-6 border-b border-standart pb-3 px-6 md:flex items-center text-12"
    >
      <div class="col-span-2 lg:block nls-14 nls-font-400 text-primary text-left text-upper text-14">
        <a
          :href="`${applicaton.network.networkAddresses.exploler}nolus-rila/tx/${transaction.id}`"
          class="his-url"
          target="_blank"
        >
          {{ truncateString(transaction.id) }}
        </a>
        <img
          src="@/assets/icons/urlicon.svg"
          class="float-right w-3 his-img mt-[0.15rem]"
        />
      </div>
      <!-- <div class="col-span-2 sm:block hidden text-left">
        <span
          class="inline-block py-1 px-2 text-patch nls-font-500 nls-12 text-primary radius-pill md:ml-4"
        >
          {{ capitalize(transaction.action) }}
        </span>
      </div> -->
      <div class="block col-span-6 nls-14 nls-font-400 text-primary text-left sm:my-1 text-14">
        <span class="nls-12 nls-font-700">
          {{ message(msg) }}
        </span>

        <!-- 
        <span v-if="transaction.msg.length > 0" class="nls-12 nls-font-700">
          {{ parseLength(transaction.msg) }}
        </span>
        <span v-else class="nls-12 nls-font-700">
          {{ truncateString(transaction.sender) }}
          {{ $t("message.to") }}
          {{ truncateString(transaction.receiver) }}
        </span> -->
      </div>
      <div class="sm:block hidden col-span-2 items-center justify-start md:justify-endtext-primary">
        <span class="left-and-right nls-14 nls-font-400 his-gray">
          {{ convertFeeAmount(transaction.fee) }}
        </span>
      </div>
      <div class="sm:block hidden col-span-2 items-center justify-start md:justify-endtext-primary">
        <span class="left-and-right nls-14 nls-font-400 his-gray">
          <template v-if="transaction.blockDate">
            {{ getCraetedAtForHuman(transaction.blockDate) }}
          </template>
          <template v-else>
            -
          </template>
        </span>
      </div>
      <div class="flex col-span-12 justify-between sm:hidden">
        <span class="left-and-right nls-14 nls-font-400 his-gray">
          {{ convertFeeAmount(transaction.fee) }}
        </span>
        <span class="left-and-right nls-14 nls-font-400 his-gray">
          <template v-if="transaction.blockDate">
            {{ getCraetedAtForHuman(transaction.blockDate) }}
          </template>
          <template v-else>
            -
          </template>
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { Coin } from "@cosmjs/proto-signing";
import type { ITransaction } from "@/views/HistoryView.vue";

import { useApplicationStore } from "@/stores/application";

import { CurrencyUtils } from "@nolus/nolusjs";
import { StringUtils } from "@/utils/StringUtils";
import { useI18n } from "vue-i18n";

enum Messages {
  "/cosmos.bank.v1beta1.MsgSend" = "/cosmos.bank.v1beta1.MsgSend"
}

const i18n = useI18n();
const applicaton = useApplicationStore();
const months = [
  i18n.t("message.jan"),
  i18n.t("message.feb"),
  i18n.t("message.mar"),
  i18n.t("message.april"),
  i18n.t("message.may"),
  i18n.t("message.jun"),
  i18n.t("message.jul"),
  i18n.t("message.aug"),
  i18n.t("message.sep"),
  i18n.t("message.oct"),
  i18n.t("message.nov"),
  i18n.t("message.dec"),
];

const sec = 1000;
const min = 60 * 1000;
const hour = 1000 * 60 * 60;
const day = 60 * 1000 * 60 * 24;

const one_s = i18n.t("message.one_s");
const many_s = i18n.t("message.many_s");

const one_m = i18n.t("message.one_m");
const many_m = i18n.t("message.many_m");

const one_h = i18n.t("message.one_h");
const many_h = i18n.t("message.many_h");

interface Props {
  transaction: ITransaction;
}
const props = defineProps<Props>();

const truncateString = (text: string) => {
  return StringUtils.truncateString(text, 6, 6);
};

const convertFeeAmount = (fee: Coin[] | null) => {
  if (fee === null) {
    return "0";
  }

  const convertFee = CurrencyUtils.convertCosmosCoinToKeplCoin(fee[0]);
  const feeAmount = CurrencyUtils.convertCoinUNolusToNolus(convertFee);
  return feeAmount?.toString();
};

const parseLength = (value: string) => {
  if (value.length > 62) {
    return `${value.slice(0, 62)}...`;
  }
  return value;
};

const getCraetedAtForHuman = (createdAt: Date | null) => {
  if (createdAt == null) {
    return props.transaction.height;
  }

  let currentDate = new Date();
  let diff = currentDate.getTime() - (createdAt as Date).getTime();

  if (diff < 0) {
    return one_s;
  }

  if (diff < min) {
    let time = Math.floor(diff / sec);
    if (time <= 1) {
      return one_s;
    }
    return `${time} ${many_s}`;
  }
  if (diff < hour) {
    let time = Math.floor(diff / min);
    if (time <= 1) {
      return one_m;
    }
    return `${time} ${many_m}`;
  }

  if (diff < day) {
    let time = Math.floor(diff / hour);
    if (time <= 1) {
      return one_h;
    }
    return `${time} ${many_h}`;
  }

  const m = months[(createdAt as Date).getMonth()];
  const date = `${(createdAt as Date).getDate()}`;
  const year = (createdAt as Date).getFullYear();

  return `${m} ${date}, ${year}`;
};

const message = (msg: Object | any) => {
  switch (msg.typeUrl) {
    case (Messages["/cosmos.bank.v1beta1.MsgSend"]): {
      if (props.transaction.type == 'sender') {
        return i18n.t('message.send-action', {
          address: truncateString(msg.data.toAddress)
        });
      }

      if (props.transaction.type == 'receiver') {
        return i18n.t('message.receive-action', {
          address: truncateString(msg.data.fromAddress)
        });
      }
    }
    default: {
      return '';
    }
  }
};
</script>
<style scoped>
.his-gray {
  color: #8396b1;
  font-family: "Garet-Medium";
}

.his-img {
  position: absolute;
  display: inline;
  margin-left: 5px;
}
</style>
