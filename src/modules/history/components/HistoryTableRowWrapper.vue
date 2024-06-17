<template>
  <template v-for="(data, index) in transactionData">
    <HistoryTableRow
      :classes="data.classes"
      :items="data.items"
    />
  </template>
</template>

<script lang="ts" setup>
import { type Coin, parseCoins } from "@cosmjs/proto-signing";
import type { ITransaction } from "../types";
import type { IObjectKeys } from "@/common/types";

import { useApplicationStore } from "@/common/stores/application";
import { useWalletStore } from "@/common/stores/wallet";
import { AppUtils, AssetUtils, getCreatedAtForHuman, Logger, StringUtils, WalletManager } from "@/common/utils";
import { ChainConstants, CurrencyUtils } from "@nolus/nolusjs";
import { useI18n } from "vue-i18n";
import { Buffer } from "buffer";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1beta1/gov";
import { CurrencyMapping } from "@/config/currencies";
import { computed, onMounted, ref } from "vue";
import type { HistoryTableRowItemProps } from "web-components";
import { HistoryTableRow } from "web-components";
import Icon from "@/assets/icons/urlicon.svg";

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
const messagesRef = ref<string[]>();
// const rowData = ref([] as HistoryTableRowItemProps[]);

//TODO: remove
const mapCurrency: { [key: string]: string } = {
  "transfer/channel-0/transfer/channel-750": "USDC"
};

const voteMessages: { [key: string]: string } = {
  [VoteOption.VOTE_OPTION_ABSTAIN]: i18n.t(`message.abstained`).toLowerCase(),
  [VoteOption.VOTE_OPTION_NO_WITH_VETO]: i18n.t(`message.veto`).toLowerCase(),
  [VoteOption.VOTE_OPTION_YES]: i18n.t(`message.yes`).toLowerCase(),
  [VoteOption.VOTE_OPTION_NO]: i18n.t(`message.no`).toLowerCase()
};

interface Props {
  transaction: ITransaction;
}
const props = defineProps<Props>();

onMounted(async () => {
  const promises = [];
  for (const m of messages()) {
    promises.push(message(m));
  }
  messagesRef.value = await Promise.all(promises);
});

const transactionData = computed(() =>
  (messagesRef.value ?? []).map(
    (msg) =>
      ({
        items: [
          {
            value: truncateString(props.transaction.id),
            url: `${applicaton.network.networkAddresses.explorer}/${props.transaction.id}`,
            icon: Icon,
            class: "text-14 uppercase max-w-[200px]"
          },
          {
            value: msg,
            bold: true,
            class: "text-14"
          },
          {
            value: convertFeeAmount(props.transaction.fee),
            class: "max-w-[200px]"
          },
          {
            value: getCreatedAtForHuman(props.transaction.blockDate) ?? props.transaction.height,
            class: "max-w-[200px]"
          }
        ]
      }) as HistoryTableRowItemProps
  )
);

function truncateString(text: string) {
  return StringUtils.truncateString(text, 6, 6);
}

function convertFeeAmount(fee: Coin[] | null) {
  if (fee === null) {
    return "0";
  }

  const convertFee = CurrencyUtils.convertCosmosCoinToKeplCoin(fee[0]);
  const feeAmount = CurrencyUtils.convertCoinUNolusToNolus(convertFee);
  return feeAmount?.toString();
}

async function message(msg: IObjectKeys) {
  switch (msg.typeUrl) {
    case Messages["/cosmos.bank.v1beta1.MsgSend"]: {
      if (props.transaction.type == "sender") {
        const token = getCurrency(msg.data?.amount?.[0]);
        return i18n.t("message.send-action", {
          address: truncateString(msg.data?.toAddress),
          amount: token.toString()
        });
      }

      if (props.transaction.type == "receiver") {
        const token = getCurrency(msg.data.amount[0]);
        return i18n.t("message.receive-action", {
          address: truncateString(msg.data.fromAddress),
          amount: token.toString()
        });
      }

      return msg.typeUrl;
    }
    case Messages["/ibc.applications.transfer.v1.MsgTransfer"]: {
      if (props.transaction.type == "sender") {
        const token = await fetchCurrency(msg.data.token);
        return i18n.t("message.send-action", {
          address: truncateString(msg.data.receiver),
          amount: token.toString()
        });
      }

      if (props.transaction.type == "receiver") {
        const token = getCurrency(msg.data.token);
        return i18n.t("message.receive-action", {
          address: truncateString(msg.data.sender),
          amount: token.toString()
        });
      }

      return msg.typeUrl;
    }
    case Messages["/ibc.core.channel.v1.MsgRecvPacket"]: {
      try {
        const buf = JSON.parse(Buffer.from(msg.data.packet.data).toString());
        const data = JSON.parse(props.transaction.log as string);
        const amount = data[1].events[0].attributes[3];
        const coin = parseCoins(amount.value)[0];
        const token = getCurrency(coin);

        return i18n.t("message.receive-action", {
          address: truncateString(buf.sender),
          amount: token.toString()
        });
      } catch (e) {
        return msg.typeUrl;
      }
    }
    case Messages["/cosmwasm.wasm.v1.MsgExecuteContract"]: {
      try {
        const data = JSON.parse(Buffer.from(msg.data.msg).toString());

        if (data.open_lease) {
          const token = getCurrency(msg.data.funds[0]);
          const cr = AssetUtils.getCurrencyByTicker(data.open_lease.currency);

          return i18n.t("message.open-position-action", {
            ticker: cr?.shortName,
            amount: token.toString()
          });
        }

        if (data.repay) {
          const token = getCurrency(msg.data.funds[0]);
          return i18n.t("message.repay-position-action", {
            contract: truncateString(msg.data.contract),
            amount: token.toString()
          });
        }

        if (data.close) {
          return i18n.t("message.close-position-action", {
            contract: truncateString(msg.data.contract)
          });
        }

        if (data.claim_rewards) {
          const log = JSON.parse(props.transaction.log as string);
          const amount = log[0].events[0].attributes[1];
          const coin = parseCoins(amount.value)[0];
          const token = getCurrency(coin);
          return i18n.t("message.claim-position-action", {
            amount: token.toString(),
            address: truncateString(msg.data.contract)
          });
        }

        if (data.deposit) {
          const token = getCurrency(msg.data.funds[0]);
          return i18n.t("message.supply-position-action", {
            amount: token.toString()
          });
        }

        if (data.burn) {
          const log = JSON.parse(props.transaction.log as string);
          const withdraw = log[0].events.find((e: IObjectKeys) => e.type == "wasm-lp-withdraw");
          const amount = withdraw.attributes.find((e: IObjectKeys) => e.key == "withdraw-amount");
          const symbol = withdraw.attributes.find((e: IObjectKeys) => e.key == "withdraw-symbol");
          const currency = AssetUtils.getCurrencyByTicker(symbol.value)!;
          let [ticker] = currency.key!.split("@");

          if (CurrencyMapping[ticker]?.name) {
            currency.shortName = CurrencyMapping[ticker]?.name!;
          }
          const token = CurrencyUtils.convertMinimalDenomToDenom(
            amount.value,
            currency?.ibcData!,
            currency?.shortName!,
            Number(currency?.decimal_digits)
          );
          return i18n.t("message.withdraw-position-action", {
            amount: token.toString()
          });
        }

        if (data.close_position?.full_close) {
          return i18n.t("message.partial-close-action", {
            contract: truncateString(msg.data.contract)
          });
        }

        if (data.close_position?.partial_close) {
          const currency = AssetUtils.getCurrencyByTicker(data.close_position?.partial_close.amount.ticker);
          const token = CurrencyUtils.convertMinimalDenomToDenom(
            data.close_position?.partial_close.amount.amount,
            currency?.ibcData!,
            currency?.shortName!,
            Number(currency?.decimal_digits)
          );

          return i18n.t("message.partial-close-action", {
            ticker: data.close_position.currency,
            amount: token.toString(),
            contract: truncateString(msg.data.contract)
          });
        }
      } catch (error) {
        Logger.error(error);
        return msg.typeUrl;
      }

      return msg.typeUrl;
    }
    case Messages["/cosmos.gov.v1beta1.MsgVote"]: {
      const m = voteMessages[msg.data.option];
      return i18n.t("message.vote-position-action", {
        vote: m,
        propose: msg.data.proposalId?.toString()
      });
    }
    case Messages["/cosmos.staking.v1beta1.MsgDelegate"]: {
      const token = getCurrency(msg.data.amount);
      return i18n.t("message.delegate-position-action", {
        validator: truncateString(msg.data.validatorAddress),
        amount: token.toString()
      });
    }
    case Messages["/cosmos.staking.v1beta1.MsgUndelegate"]: {
      const token = getCurrency(msg.data.amount);
      return i18n.t("message.undelegate-position-action", {
        validator: truncateString(msg.data?.validatorAddress),
        amount: token.toString()
      });
    }
    case Messages["/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"]: {
      const log = JSON.parse(props.transaction.log as string);
      const amount = getAmount(log);
      const coin = parseCoins(amount.value)[0];
      const token = getCurrency(coin);
      return i18n.t("message.claim-position-action", {
        amount: token.toString(),
        address: truncateString(msg.data?.validatorAddress)
      });
    }
    case Messages["/cosmos.staking.v1beta1.MsgBeginRedelegate"]: {
      const token = getCurrency(msg.data?.amount);
      return i18n.t("message.redelegate-action", {
        amount: token.toString(),
        address: truncateString(msg.data?.validatorDstAddress)
      });
    }
    default: {
      return msg.typeUrl;
    }
  }
}

function getAmount(log: IObjectKeys) {
  for (const l of log[0].events) {
    for (const v of l.attributes) {
      if (v.key == "amount") {
        return v;
      }
    }
  }
}

function getCurrency(amount: Coin) {
  const info = AssetUtils.getCurrencyByDenom(amount.denom);
  const token = CurrencyUtils.convertMinimalDenomToDenom(
    amount?.amount,
    info?.ibcData,
    info?.shortName ?? truncateString(amount.denom),
    Number(info?.decimal_digits ?? 0)
  );

  return token;
}

function messages() {
  return props.transaction.msgs.filter((item) => {
    switch (item.typeUrl) {
      case Messages["/cosmos.bank.v1beta1.MsgSend"]: {
        return !(
          props.transaction.type == "receiver" &&
          item.data.toAddress != (wallet.wallet?.address ?? WalletManager.getWalletAddress())
        );
      }
      case Messages["/ibc.applications.transfer.v1.MsgTransfer"]: {
        return !(
          props.transaction.type == "receiver" &&
          item.data.toAddress != (wallet.wallet?.address ?? WalletManager.getWalletAddress())
        );
      }
      case Messages["/ibc.core.channel.v1.MsgRecvPacket"]: {
        try {
          const data = JSON.parse(props.transaction.log as string);
          const receiver = data?.[1]?.events?.[0]?.attributes?.[2];

          if (receiver?.value != (wallet.wallet?.address ?? WalletManager.getWalletAddress())) {
            return false;
          }
        } catch (e) {
          return false;
        }
        return true;
      }
      case Messages["/cosmos.gov.v1beta1.MsgVote"]: {
        return item.data.voter == (wallet.wallet?.address ?? WalletManager.getWalletAddress());
      }
      case Messages["/cosmos.staking.v1beta1.MsgDelegate"]: {
        return item.data.delegatorAddress == (wallet.wallet?.address ?? WalletManager.getWalletAddress());
      }
      case Messages["/cosmos.staking.v1beta1.MsgUndelegate"]: {
        return item.data.delegatorAddress == (wallet.wallet?.address ?? WalletManager.getWalletAddress());
      }
      case Messages["/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"]: {
        return item.data.delegatorAddress == (wallet.wallet?.address ?? WalletManager.getWalletAddress());
      }
      case Messages["/ibc.core.client.v1.MsgUpdateClient"]: {
        return false;
      }
      case Messages["/ibc.core.channel.v1.MsgAcknowledgement"]: {
        return false;
      }
      case Messages["/cosmwasm.wasm.v1.MsgExecuteContract"]: {
        try {
          const data = JSON.parse(Buffer.from(item.data.msg).toString());

          if (item.data.sender != (wallet.wallet?.address ?? WalletManager.getWalletAddress())) {
            return false;
          }

          if (data.dispatch_alarms) {
            return false;
          }
        } catch (e) {
          return false;
        }

        return true;
      }

      case Messages["/cosmos.staking.v1beta1.MsgBeginRedelegate"]: {
        return props.transaction.type != "receiver";
      }
    }

    return true;
  });
}

async function fetchCurrency(amount: Coin) {
  const api = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
  const data = await fetch(`${api}/ibc/apps/transfer/v1/denom_traces/${amount.denom}`);
  const json = await data.json();
  const currency = AssetUtils.getCurrencyBySymbol(json.denom_trace.base_denom);
  const name = mapCurrency[json.denom_trace.path];
  return CurrencyUtils.convertMinimalDenomToDenom(
    amount?.amount,
    currency?.ibcData,
    name ?? currency?.shortName ?? truncateString(amount.denom),
    Number(currency?.decimal_digits ?? 0)
  );
}
</script>

<style lang="" scoped></style>
