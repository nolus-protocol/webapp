<template>
  <template v-for="(data, index) in transactionData">
    <HistoryTableRow
      :classes="data.classes"
      :items="data.items"
    />
  </template>
</template>

<script lang="ts" setup>
import { coin, parseCoins, type Coin } from "@cosmjs/proto-signing";
import type { ITransactionData } from "../types";
import type { IObjectKeys } from "@/common/types";

import { useApplicationStore } from "@/common/stores/application";
import { useWalletStore } from "@/common/stores/wallet";
import { AppUtils, AssetUtils, getCreatedAtForHuman, Logger, StringUtils, WalletManager } from "@/common/utils";
import { ChainConstants, CurrencyUtils } from "@nolus/nolusjs";
import { useI18n } from "vue-i18n";
import { Buffer } from "buffer";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1beta1/gov";
import { computed, onMounted, ref } from "vue";
import type { HistoryTableRowItemProps } from "web-components";
import { HistoryTableRow } from "web-components";
import Icon from "@/assets/icons/urlicon.svg";
import { PositionTypes, ProtocolsConfig } from "@/config/global";

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

const voteMessages: { [key: string]: string } = {
  [VoteOption.VOTE_OPTION_ABSTAIN]: i18n.t(`message.abstained`).toLowerCase(),
  [VoteOption.VOTE_OPTION_NO_WITH_VETO]: i18n.t(`message.veto`).toLowerCase(),
  [VoteOption.VOTE_OPTION_YES]: i18n.t(`message.yes`).toLowerCase(),
  [VoteOption.VOTE_OPTION_NO]: i18n.t(`message.no`).toLowerCase()
};

interface Props {
  transaction: ITransactionData;
}
const props = defineProps<Props>();

onMounted(async () => {
  const promises = [];
  promises.push(message(props.transaction));
  messagesRef.value = await Promise.all(promises);
});

const transactionData = computed(() =>
  (messagesRef.value ?? []).map(
    (msg) =>
      ({
        items: [
          {
            value: truncateString(props.transaction.tx_hash),
            url: `${applicaton.network.networkAddresses.explorer}/${props.transaction.tx_hash}`,
            icon: Icon,
            class: "text-14 uppercase max-w-[200px]"
          },
          {
            value: msg,
            bold: true,
            class: "text-14"
          },
          {
            value: convertFeeAmount(coin(props.transaction.fee_amount, props.transaction.fee_denom)),
            class: "max-w-[200px]"
          },
          {
            value: getCreatedAtForHuman(props.transaction.timestamp) ?? props.transaction.block,
            class: "max-w-[200px]"
          }
        ]
      }) as HistoryTableRowItemProps
  )
);

function truncateString(text: string) {
  return StringUtils.truncateString(text, 6, 6);
}

function convertFeeAmount(fee: Coin) {
  if (fee === null) {
    return "0";
  }

  const convertFee = CurrencyUtils.convertCosmosCoinToKeplCoin(fee);
  const feeAmount = CurrencyUtils.convertCoinUNolusToNolus(convertFee);
  return feeAmount?.toString();
}

async function message(msg: IObjectKeys) {
  switch (msg.type) {
    case Messages["/cosmos.bank.v1beta1.MsgSend"]: {
      if (msg.from == wallet.wallet?.address) {
        const token = getCurrency(msg.data?.amount?.[0]);
        return i18n.t("message.send-action", {
          address: truncateString(msg.data?.toAddress),
          amount: token.toString()
        });
      }

      if (msg.to == wallet.wallet?.address) {
        const token = getCurrency(msg.data.amount[0]);
        return i18n.t("message.receive-action", {
          address: truncateString(msg.data.fromAddress),
          amount: token.toString()
        });
      }
      return msg.type;
    }
    case Messages["/ibc.applications.transfer.v1.MsgTransfer"]: {
      if (msg.from == wallet.wallet?.address) {
        const token = await fetchCurrency(msg.data.token);
        return i18n.t("message.send-action", {
          address: truncateString(msg.data.receiver),
          amount: token.toString()
        });
      }

      if (msg.to == wallet.wallet?.address) {
        const token = getCurrency(msg.data.token);
        return i18n.t("message.receive-action", {
          address: truncateString(msg.data.sender),
          amount: token.toString()
        });
      }

      return msg.type;
    }
    case Messages["/ibc.core.channel.v1.MsgRecvPacket"]: {
      try {
        const data = JSON.parse(Buffer.from(msg.data.packet.data).toString());
        const denom = AssetUtils.getIbc(
          `${msg.data.packet.destinationPort}/${msg.data.packet.destinationChannel}/${data.denom}`
        );
        const coin = parseCoins(`${data.amount}${denom}`)[0];
        const token = await fetchCurrency(coin);
        return i18n.t("message.receive-action", {
          address: truncateString(data.sender),
          amount: token.toString()
        });
      } catch (e) {
        console.log(e);
        return msg.type;
      }
    }
    case Messages["/cosmwasm.wasm.v1.MsgExecuteContract"]: {
      try {
        const data = JSON.parse(Buffer.from(msg.data.msg).toString());

        if (data.open_lease) {
          const token = getCurrency(msg.data.funds[0]);
          const cr = AssetUtils.getCurrencyByTicker(data.open_lease.currency);
          const item = AssetUtils.getProtocolByContract(msg.data.contract);
          const protocol = ProtocolsConfig[item];

          if (protocol.type == PositionTypes.short) {
            const lpn = AssetUtils.getLpnByProtocol(item);

            return i18n.t("message.open-short-position-action", {
              ticker: cr?.shortName,
              LPN_ticker: lpn.shortName,
              position: i18n.t(`message.${protocol.type}`).toLowerCase(),
              amount: token.toString()
            });
          }

          return i18n.t("message.open-position-action", {
            ticker: cr?.shortName,
            position: i18n.t(`message.${protocol.type}`).toLowerCase(),
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
          const coin = msg.rewards ? getCurrency(parseCoins(`${msg.rewards}`)[0]).toString() : "";

          return i18n.t("message.claim-position-action", {
            amount: coin,
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
          const protocol = AssetUtils.getProtocolByContract(msg.data.contract);
          const lpn = AssetUtils.getLpnByProtocol(protocol);

          const token = CurrencyUtils.convertMinimalDenomToDenom(
            data.burn.amount,
            lpn.ibcData!,
            lpn.shortName!,
            Number(lpn.decimal_digits)
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
        return msg.type;
      }

      return msg.type;
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
      const coin = msg.rewards ? getCurrency(parseCoins(`${msg.rewards}`)[0]).toString() : "";

      return i18n.t("message.claim-position-action", {
        amount: coin,
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

async function fetchCurrency(amount: Coin) {
  let coin;
  try {
    coin = AssetUtils.getCurrencyByDenom(amount.denom);
  } catch (e) {
    console.log(e);
  }

  if (coin) {
    return CurrencyUtils.convertMinimalDenomToDenom(
      amount?.amount,
      coin?.ibcData,
      coin?.shortName ?? truncateString(amount.denom),
      Number(coin?.decimal_digits ?? 0)
    );
  }

  const api = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
  const data = await fetch(`${api}/ibc/apps/transfer/v1/denom_traces/${amount.denom}`);
  const json = await data.json();
  const currency = AssetUtils.getCurrencyBySymbol(json.denom_trace.base_denom);

  return CurrencyUtils.convertMinimalDenomToDenom(
    amount?.amount,
    currency?.ibcData,
    currency?.shortName ?? truncateString(amount.denom),
    Number(currency?.decimal_digits ?? 0)
  );
}
</script>

<style lang="" scoped></style>
