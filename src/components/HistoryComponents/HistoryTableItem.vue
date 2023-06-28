<template>
  <div class="history-item">
    <div
      v-for="(msg, index) in messages()"
      :key="index"
      class="md:grid md:grid-cols-12 pt-3 gap-6 border-b border-standart pb-3 px-3 md:px-6 md:flex items-center text-12"
    >
      <div class="col-span-2 lg:block nls-14 nls-font-400 text-primary text-left text-upper text-14">
        <a
          :href="`${applicaton.network.networkAddresses.explorer}/${transaction.id}`"
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

      <div class="block col-span-6 nls-14 nls-font-400 text-primary text-left sm:my-1 text-14">
        <span class="nls-12 nls-font-700">
          {{ message(msg) }}
        </span>

      </div>
      <div class="sm:block hidden col-span-2 items-center justify-start md:justify-endtext-primary">
        <span class="left-and-right nls-14 nls-font-400 his-gray">
          {{ convertFeeAmount(transaction.fee) }}
        </span>
      </div>
      <div class="sm:block hidden col-span-2 items-center justify-start md:justify-endtext-primary">
        <span class="left-and-right nls-14 nls-font-400 his-gray">
          <template v-if="transaction.blockDate">
            {{ getCreatedAtForHuman(transaction.blockDate) }}
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
            {{ getCreatedAtForHuman(transaction.blockDate) }}
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
import { parseCoins, type Coin } from "@cosmjs/proto-signing";
import type { ITransaction } from "@/views/HistoryView.vue";

import { useApplicationStore } from "@/stores/application";

import { CurrencyUtils } from "@nolus/nolusjs";
import { StringUtils } from "@/utils/StringUtils";
import { useI18n } from "vue-i18n";
import { useWalletStore } from "@/stores/wallet";
import { Buffer } from "buffer";
import { AssetUtils, WalletManager } from "@/utils";

enum Messages {
  "/cosmos.bank.v1beta1.MsgSend" = "/cosmos.bank.v1beta1.MsgSend",
  "/ibc.applications.transfer.v1.MsgTransfer" = "/ibc.applications.transfer.v1.MsgTransfer",
  "/cosmwasm.wasm.v1.MsgExecuteContract" = "/cosmwasm.wasm.v1.MsgExecuteContract",
  "/cosmos.gov.v1beta1.MsgVote" = "/cosmos.gov.v1beta1.MsgVote",
  "/cosmos.staking.v1beta1.MsgDelegate" = "/cosmos.staking.v1beta1.MsgDelegate",
  "/cosmos.staking.v1beta1.MsgUndelegate" = "/cosmos.staking.v1beta1.MsgUndelegate",
  "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward" = "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
  "/ibc.core.client.v1.MsgUpdateClient" = "/ibc.core.client.v1.MsgUpdateClient",
  "/ibc.core.channel.v1.MsgAcknowledgement" = "/ibc.core.channel.v1.MsgAcknowledgement",
  "/ibc.core.channel.v1.MsgRecvPacket" = "/ibc.core.channel.v1.MsgRecvPacket",
  "/cosmos.staking.v1beta1.MsgBeginRedelegate" = "/cosmos.staking.v1beta1.MsgBeginRedelegate"
}

const i18n = useI18n();
const applicaton = useApplicationStore();
const wallet = useWalletStore();
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

function truncateString(text: string) {
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

function getCreatedAtForHuman(createdAt: Date | null) {
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
        const token = getCurrency(msg.data?.amount?.[0]);
        return i18n.t('message.send-action', {
          address: truncateString(msg.data?.toAddress),
          amount: token.toString()
        });
      }

      if (props.transaction.type == 'receiver') {
        const token = getCurrency(msg.data.amount[0]);
        return i18n.t('message.receive-action', {
          address: truncateString(msg.data.fromAddress),
          amount: token.toString()
        });
      }

      return msg.typeUrl;
    }
    case (Messages["/ibc.applications.transfer.v1.MsgTransfer"]): {
      if (props.transaction.type == 'sender') {
        const token = getCurrency(msg.data.token);
        return i18n.t('message.send-action', {
          address: truncateString(msg.data.receiver),
          amount: token.toString()
        });
      }

      if (props.transaction.type == 'receiver') {
        const token = getCurrency(msg.data.token);
        return i18n.t('message.receive-action', {
          address: truncateString(msg.data.sender),
          amount: token.toString()
        });
      }

      return msg.typeUrl;
    }
    case (Messages["/ibc.core.channel.v1.MsgRecvPacket"]): {

      try {

        const buf = JSON.parse(Buffer.from(msg.data.packet.data).toString());
        const data = JSON.parse(props.transaction.log as string);
        const amount = data[1].events[0].attributes[3];
        const coin = parseCoins(amount.value)[0];
        const token = getCurrency(coin);

        return i18n.t('message.receive-action', {
          address: truncateString(buf.sender),
          amount: token.toString()
        });

      } catch (e) {
        return msg.typeUrl;
      }

    }
    case (Messages["/cosmwasm.wasm.v1.MsgExecuteContract"]): {
      try {
        const data = JSON.parse(Buffer.from(msg.data.msg).toString());

        if (data.open_lease) {
          const token = getCurrency(msg.data.funds[0]);
          return i18n.t('message.open-position-action', {
            ticker: data.open_lease.currency,
            amount: token.toString()
          });
        }

        if (data.repay) {
          const token = getCurrency(msg.data.funds[0]);
          return i18n.t('message.repay-position-action', {
            contract: truncateString(msg.data.contract),
            amount: token.toString()
          });
        }

        if (data.close) {
          return i18n.t('message.close-position-action', {
            contract: truncateString(msg.data.contract),
          });
        }

        if (data.claim_rewards) {
          const log = JSON.parse(props.transaction.log as string);
          const amount = log[0].events[0].attributes[1];
          const coin = parseCoins(amount.value)[0];
          const token = getCurrency(coin);
          return i18n.t('message.claim-position-action', {
            amount: token.toString(),
          });
        }

        if (data.deposit) {
          const token = getCurrency(msg.data.funds[0]);
          return i18n.t('message.supply-position-action', {
            amount: token.toString()
          });
        }

        if (data.burn) {
          const log = JSON.parse(props.transaction.log as string);
          const amount = log[0].events[0].attributes[1];
          const coin = parseCoins(amount.value)[0];
          const token = getCurrency(coin);
          return i18n.t('message.withdraw-position-action', {
            amount: token.toString(),
          });
        }

      } catch (error) {
        return msg.typeUrl
      }


      return msg.typeUrl;
    }
    case (Messages["/cosmos.gov.v1beta1.MsgVote"]): {
      return i18n.t('message.vote-position-action', {
        vote: msg.data.option ? i18n.t('message.yes') : i18n.t('message.no'),
        propose: msg.data.proposalId?.toString()
      });
    }
    case (Messages["/cosmos.staking.v1beta1.MsgDelegate"]): {
      const token = getCurrency(msg.data.amount);
      return i18n.t('message.delegate-position-action', {
        validator: truncateString(msg.data.validatorAddress),
        amount: token.toString()
      });
    }
    case (Messages["/cosmos.staking.v1beta1.MsgUndelegate"]): {
      const token = getCurrency(msg.data.amount);
      return i18n.t('message.undelegate-position-action', {
        validator: truncateString(msg.data?.validatorAddress),
        amount: token.toString()
      });
    }
    case (Messages["/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"]): {
      const log = JSON.parse(props.transaction.log as string);
      const amount = getAmount(log);
      const coin = parseCoins(amount.value)[0];
      const token = getCurrency(coin);

      return i18n.t('message.claim-position-action', {
        amount: token.toString(),
        address: truncateString(msg.data?.validatorAddress)
      });
    }
    case (Messages['/cosmos.staking.v1beta1.MsgBeginRedelegate']): {
      const token = getCurrency(msg.data?.amount);
      return i18n.t('message.redelegate-action', {
        amount: token.toString(),
        address: truncateString(msg.data?.validatorDstAddress)
      });
    }
    default: {
      return msg.typeUrl;
    }
  }
};

const getAmount = (log: any) => {
  for(const l of log[0].events){
    for(const v of l.attributes){
      if(v.key == 'amount'){
        return v
      }
    }
  }
}

const getCurrency = (amount: Coin) => {
  const currency = amount;
  const info = wallet.getCurrencyInfo(amount.denom);

  const token = CurrencyUtils.convertMinimalDenomToDenom(
    currency?.amount,
    info.coinMinimalDenom,
    info.shortName,
    info.coinDecimals
  );

  return token;
}

const messages = () => {
  return props.transaction.msgs.filter((item) => {
    switch (item.typeUrl) {

      case (Messages["/cosmos.bank.v1beta1.MsgSend"]): {
        if (props.transaction.type == 'receiver' && item.data.toAddress != (wallet.wallet?.address ?? WalletManager.getWalletAddress())) {
          return false
        }

        return true;
      }

      case (Messages["/ibc.applications.transfer.v1.MsgTransfer"]): {

        if (props.transaction.type == 'receiver' && item.data.toAddress != (wallet.wallet?.address ?? WalletManager.getWalletAddress())) {
          return false
        }

        return true;
      }

      case (Messages["/ibc.core.channel.v1.MsgRecvPacket"]): {
        try {
          const data = JSON.parse(props.transaction.log as string);
          const receiver = data?.[1]?.events?.[0]?.attributes?.[2];

          if (receiver?.value != (wallet.wallet?.address ?? WalletManager.getWalletAddress())) {
            return false
          }

        } catch (e) {
          return false
        }
        return true;
      }
      case (Messages["/cosmos.gov.v1beta1.MsgVote"]): {
        if (item.data.voter != (wallet.wallet?.address ?? WalletManager.getWalletAddress())) {
          return false
        }
        return true;
      }

      case (Messages["/cosmos.staking.v1beta1.MsgDelegate"]): {
        if (item.data.delegatorAddress != (wallet.wallet?.address ?? WalletManager.getWalletAddress())) {
          return false
        }
        return true;
      }

      case (Messages["/cosmos.staking.v1beta1.MsgUndelegate"]): {
        if (item.data.delegatorAddress != (wallet.wallet?.address ?? WalletManager.getWalletAddress())) {
          return false
        }

        return true;
      }

      case (Messages["/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"]): {
        if (item.data.delegatorAddress != (wallet.wallet?.address ?? WalletManager.getWalletAddress())) {
          return false
        }
        return true;
      }

      case (Messages["/ibc.core.client.v1.MsgUpdateClient"]): {
        return false;
      }
      case (Messages["/ibc.core.channel.v1.MsgAcknowledgement"]): {
        return false;
      }
      case (Messages["/cosmwasm.wasm.v1.MsgExecuteContract"]): {

        try {
          const data = JSON.parse(Buffer.from(item.data.msg).toString());

          if (item.data.sender != (wallet.wallet?.address ?? WalletManager.getWalletAddress())) {
            return false
          }

          if (data.dispatch_alarms) {
            return false;
          }

        } catch (e) {
          return false
        }

        return true;
      }

      case (Messages['/cosmos.staking.v1beta1.MsgBeginRedelegate']): {
        if (props.transaction.type == 'receiver') {
          return false;
        }
        return true;
      }
    }

    return true;
  });
}
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
