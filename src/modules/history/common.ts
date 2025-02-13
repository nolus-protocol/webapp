import type { IObjectKeys } from "@/common/types";
import { type Coin, parseCoins } from "@cosmjs/proto-signing";

import { Messages } from "./types";
import { AppUtils, AssetUtils, Logger, StringUtils } from "@/common/utils";
import { PositionTypes, ProtocolsConfig } from "@/config/global";
import { Buffer } from "buffer";
import { ChainConstants, CurrencyUtils } from "@nolus/nolusjs";

const currency_mapper: { [key: string]: string } = {
  "transfer/channel-0/transfer/channel-783/unls": "unls"
};

export async function message(msg: IObjectKeys, address: string, i18n: IObjectKeys, voteMessages: IObjectKeys) {
  switch (msg.type) {
    case Messages["/cosmos.bank.v1beta1.MsgSend"]: {
      if (msg.from == address) {
        const token = getCurrency(msg.data?.amount?.[0]);
        return [
          i18n.t("message.send-action", {
            address: truncateString(msg.data?.toAddress),
            amount: token.toString()
          }),
          token
        ];
      }

      if (msg.to == address) {
        const token = getCurrency(msg.data.amount[0]);
        return [
          i18n.t("message.receive-action", {
            address: truncateString(msg.data.fromAddress),
            amount: token.toString()
          }),
          token
        ];
      }
      return msg.type;
    }
    case Messages["/ibc.applications.transfer.v1.MsgTransfer"]: {
      if (msg.from == address) {
        const token = await fetchCurrency(msg.data.token);
        return [
          i18n.t("message.send-action", {
            address: truncateString(msg.data.receiver),
            amount: token.toString()
          }),
          token
        ];
      }

      if (msg.to == address) {
        const token = getCurrency(msg.data.token);
        return [
          i18n.t("message.receive-action", {
            address: truncateString(msg.data.sender),
            amount: token.toString()
          }),
          token
        ];
      }

      return msg.type;
    }
    case Messages["/ibc.core.channel.v1.MsgRecvPacket"]: {
      try {
        const data = JSON.parse(Buffer.from(msg.data.packet.data).toString());
        const d = `${msg.data.packet.destinationPort}/${msg.data.packet.destinationChannel}/${data.denom}`;
        const denom = currency_mapper[d] ?? AssetUtils.getIbc(d);
        const coin = parseCoins(`${data.amount}${denom}`)[0];

        const token = await fetchCurrency(coin);
        return [
          i18n.t("message.receive-action", {
            address: truncateString(data.sender),
            amount: token.toString()
          }),
          token
        ];
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

            return [
              i18n.t("message.open-short-position-action", {
                ticker: cr?.shortName,
                LPN_ticker: lpn.shortName,
                position: i18n.t(`message.${protocol.type}`).toLowerCase(),
                amount: token.toString()
              }),
              token
            ];
          }

          return [
            i18n.t("message.open-position-action", {
              ticker: cr?.shortName,
              position: i18n.t(`message.${protocol.type}`).toLowerCase(),
              amount: token.toString()
            }),
            token
          ];
        }

        if (data.repay) {
          const token = getCurrency(msg.data.funds[0]);
          return [
            i18n.t("message.repay-position-action", {
              contract: truncateString(msg.data.contract),
              amount: token.toString()
            }),
            token
          ];
        }

        if (data.close) {
          return [
            i18n.t("message.close-position-action", {
              contract: truncateString(msg.data.contract)
            }),
            null
          ];
        }

        if (data.claim_rewards) {
          const coin = msg.rewards ? getCurrency(parseCoins(`${msg.rewards}`)[0]).toString() : "";

          return [
            i18n.t("message.claim-position-action", {
              amount: coin,
              address: truncateString(msg.data.contract)
            }),
            coin
          ];
        }

        if (data.deposit) {
          const token = getCurrency(msg.data.funds[0]);
          return [
            i18n.t("message.supply-position-action", {
              amount: token.toString()
            }),
            token
          ];
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
          return [
            i18n.t("message.withdraw-position-action", {
              amount: token.toString()
            }),
            token
          ];
        }

        if (data.close_position?.full_close) {
          return [
            i18n.t("message.partial-close-action", {
              contract: truncateString(msg.data.contract)
            }),
            null
          ];
        }

        if (data.close_position?.partial_close) {
          const currency = AssetUtils.getCurrencyByTicker(data.close_position?.partial_close.amount.ticker);
          const token = CurrencyUtils.convertMinimalDenomToDenom(
            data.close_position?.partial_close.amount.amount,
            currency?.ibcData!,
            currency?.shortName!,
            Number(currency?.decimal_digits)
          );

          return [
            i18n.t("message.partial-close-action", {
              ticker: data.close_position.currency,
              amount: token.toString(),
              contract: truncateString(msg.data.contract)
            }),
            token
          ];
        }
      } catch (error) {
        Logger.error(error);
        return msg.type;
      }

      return msg.type;
    }
    case Messages["/cosmos.gov.v1beta1.MsgVote"]: {
      const m = voteMessages[msg.data.option];
      return [
        i18n.t("message.vote-position-action", {
          vote: m,
          propose: msg.data.proposalId?.toString()
        }),
        null
      ];
    }
    case Messages["/cosmos.staking.v1beta1.MsgDelegate"]: {
      const token = getCurrency(msg.data.amount);
      return [
        i18n.t("message.delegate-position-action", {
          validator: truncateString(msg.data.validatorAddress),
          amount: token.toString()
        }),
        token
      ];
    }
    case Messages["/cosmos.staking.v1beta1.MsgUndelegate"]: {
      const token = getCurrency(msg.data.amount);
      return [
        i18n.t("message.undelegate-position-action", {
          validator: truncateString(msg.data?.validatorAddress),
          amount: token.toString()
        }),
        token
      ];
    }
    case Messages["/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"]: {
      const coin = msg.rewards ? getCurrency(parseCoins(`${msg.rewards}`)[0]).toString() : "";

      return [
        i18n.t("message.claim-position-action", {
          amount: coin,
          address: truncateString(msg.data?.validatorAddress)
        }),
        coin
      ];
    }
    case Messages["/cosmos.staking.v1beta1.MsgBeginRedelegate"]: {
      const token = getCurrency(msg.data?.amount);
      return [
        i18n.t("message.redelegate-action", {
          amount: token.toString(),
          address: truncateString(msg.data?.validatorDstAddress)
        }),
        token
      ];
    }
    default: {
      return msg.typeUrl;
    }
  }
}

export function action(msg: IObjectKeys, i18n: IObjectKeys) {
  switch (msg.type) {
    case Messages["/cosmos.bank.v1beta1.MsgSend"]: {
      return i18n.t("message.transfer-action");
    }
    case Messages["/ibc.applications.transfer.v1.MsgTransfer"]: {
      return i18n.t("message.transfer-action");
    }
    case Messages["/ibc.core.channel.v1.MsgRecvPacket"]: {
      return i18n.t("message.transfer-action");
    }
    case Messages["/cosmwasm.wasm.v1.MsgExecuteContract"]: {
      try {
        const data = JSON.parse(Buffer.from(msg.data.msg).toString());

        if (data.open_lease) {
          return i18n.t("message.leases");
        }

        if (data.repay) {
          return i18n.t("message.leases");
        }

        if (data.close) {
          return i18n.t("message.leases");
        }

        if (data.claim_rewards) {
          return i18n.t("message.earn");
        }

        if (data.deposit) {
          return i18n.t("message.earn");
        }

        if (data.burn) {
          return i18n.t("message.earn");
        }

        if (data.close_position?.full_close) {
          return i18n.t("message.leases");
        }

        if (data.close_position?.partial_close) {
          return i18n.t("message.leases");
        }
      } catch (error) {
        Logger.error(error);
        return msg.type;
      }
    }
    case Messages["/cosmos.gov.v1beta1.MsgVote"]: {
      return i18n.t("message.vote");
    }
    case Messages["/cosmos.staking.v1beta1.MsgDelegate"]: {
      return i18n.t("message.stake");
    }
    case Messages["/cosmos.staking.v1beta1.MsgUndelegate"]: {
      return i18n.t("message.stake");
    }
    case Messages["/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"]: {
      return i18n.t("message.stake");
    }
    case Messages["/cosmos.staking.v1beta1.MsgBeginRedelegate"]: {
      return i18n.t("message.stake");
    }
    default: {
      return msg.typeUrl;
    }
  }
}

function truncateString(text: string) {
  return StringUtils.truncateString(text, 6, 6);
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
