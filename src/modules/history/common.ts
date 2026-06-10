import type { IObjectKeys } from "@/common/types";
import { type Coin, parseCoins } from "@cosmjs/proto-signing";

import { Messages } from "./types";
import { Logger, TextFormat } from "@/common/utils";
import {
  getCurrencyByTicker,
  getCurrencyByTickerForProtocol,
  tryGetCurrencyByDenom,
  tryGetCurrencyBySymbol,
  getProtocolByContract,
  getLpnByProtocol
} from "@/common/utils/CurrencyLookup";
import { getIbc } from "@/common/utils/IbcUtils";
import { NATIVE_NETWORK } from "@/config/global";
import { Buffer } from "buffer";
import { CurrencyUtils } from "@nolus/nolusjs";
import { bech32 } from "bech32";
import { useConfigStore } from "@/common/stores/config";
import { h } from "vue";
import { BackendApi } from "@/common/api";
import { formatCoinPretty } from "@/common/utils/NumberFormatUtils";

const currency_mapper: { [key: string]: string } = {
  "transfer/channel-0/transfer/channel-783/unls": "unls"
};

export async function message(msg: IObjectKeys, address: string, i18n: IObjectKeys, voteMessages: IObjectKeys) {
  const t = translatorOf(i18n);
  switch (msg.type) {
    case Messages["/cosmos.bank.v1beta1.MsgSend"]: {
      const data = recordOf(msg.data);
      const coin = firstCoinOf(data.amount);
      if (coin === undefined) {
        console.error("[history] skipping MsgSend entry with malformed amount:", msg.tx_hash);
        return [formatMessageType(msg.type), null];
      }
      const steps = [
        {
          icon: NATIVE_NETWORK.icon
        }
      ];
      const token = getCurrency(coin);

      const detailedSteps = [
        {
          label: t("message.send-stepper"),
          icon: NATIVE_NETWORK.icon,
          tokenComponent: () => h("div", `${token}`),
          meta: () => h("div", `${NATIVE_NETWORK.label} > ${NATIVE_NETWORK.label}`)
        }
      ];

      if (msg.from === address) {
        return [
          t("message.send-action", {
            address: truncateString(stringOf(data.toAddress)),
            amount: formatCoinPretty(token)
          }),
          token,
          {
            activeStep: steps.length,
            steps
          },
          {
            activeStep: detailedSteps.length,
            steps: detailedSteps
          }
        ];
      }

      if (msg.to === address) {
        return [
          t("message.receive-action", {
            address: truncateString(stringOf(data.fromAddress)),
            amount: formatCoinPretty(token)
          }),
          token,
          {
            activeStep: steps.length,
            steps
          },
          {
            activeStep: detailedSteps.length,
            steps: detailedSteps
          }
        ];
      }
      return [formatMessageType(msg.type), null];
    }
    case Messages["/ibc.applications.transfer.v1.MsgTransfer"]: {
      const data = recordOf(msg.data);
      if (msg.from === address) {
        const coin = coinOf(data.token);
        if (coin === undefined) {
          console.error("[history] skipping MsgTransfer entry with malformed token:", msg.tx_hash);
          return [formatMessageType(msg.type), null];
        }
        const token = await fetchCurrency(coin);

        const receiverAddress = stringOf(data.receiver);
        const senderAddress = stringOf(data.sender);
        const receiver = getIcon(getChainName(receiverAddress));
        const sender = getIcon(getChainName(senderAddress));
        const labelReceiver = getChainLabel(getChainName(receiverAddress));
        const labelSender = getChainLabel(getChainName(senderAddress));

        const steps = [
          {
            icon: sender
          },
          {
            icon: receiver
          }
        ];

        const detailedSteps = [
          {
            label: t("message.send-stepper"),
            icon: sender,
            tokenComponent: () => h("div", `${token}`),
            meta: () => h("div", `${labelSender} > ${labelReceiver}`)
          },
          {
            label: t("message.receive-stepper"),
            icon: receiver,
            tokenComponent: () => h("div", `${token}`),
            meta: () => h("div", `${labelReceiver}`)
          }
        ];

        return [
          t("message.send-action", {
            address: truncateString(receiverAddress),
            amount: formatCoinPretty(token)
          }),
          token,
          {
            activeStep: steps.length,
            steps
          },
          {
            activeStep: detailedSteps.length,
            steps: detailedSteps
          }
        ];
      }

      if (msg.to === address) {
        const coin = coinOf(data.token);
        if (coin === undefined) {
          console.error("[history] skipping MsgTransfer entry with malformed token:", msg.tx_hash);
          return [formatMessageType(msg.type), null];
        }
        const token = getCurrency(coin);
        return [
          t("message.receive-action", {
            address: truncateString(stringOf(data.sender)),
            amount: formatCoinPretty(token)
          }),
          token
        ];
      }

      return [formatMessageType(msg.type), null];
    }
    case Messages["/ibc.core.channel.v1.MsgRecvPacket"]: {
      try {
        const packet = recordOf(recordOf(msg.data).packet);
        const packetPayload = packet.data;
        if (typeof packetPayload !== "string" && !(packetPayload instanceof Uint8Array)) {
          throw new Error("malformed IBC packet payload");
        }
        const data = JSON.parse(Buffer.from(packetPayload).toString());
        const d = `${packet.destinationPort}/${packet.destinationChannel}/${data.denom}`;
        const denom = currency_mapper[d] ?? getIbc(d);
        const coin = parseCoins(`${data.amount}${denom}`)[0];
        if (coin === undefined) {
          throw new Error("no coin parsed from IBC packet amount");
        }
        delete msg.fee_denom;

        const receiver = getIcon(getChainName(data.receiver));
        const sender = getIcon(getChainName(data.sender));
        const labelReceiver = getChainLabel(getChainName(data.receiver));
        const labelSender = getChainLabel(getChainName(data.sender));

        const detailedSteps = [
          {
            label: t("message.send-stepper"),
            icon: sender,
            tokenComponent: () => h("div", `${token}`),
            meta: () => h("div", `${labelSender} > ${labelReceiver}`)
          },
          {
            label: t("message.receive-stepper"),
            icon: receiver,
            tokenComponent: () => h("div", `${token}`),
            meta: () => h("div", `${labelReceiver}`)
          }
        ];
        const token = await fetchCurrency(coin, data.denom);
        const steps = [
          {
            icon: sender
          },
          {
            icon: receiver
          }
        ];
        return [
          t("message.receive-action", {
            address: truncateString(data.sender),
            amount: formatCoinPretty(token)
          }),
          token,
          {
            activeStep: steps.length,
            steps
          },
          {
            activeStep: detailedSteps.length,
            steps: detailedSteps
          }
        ];
      } catch {
        return [formatMessageType(msg.type), null];
      }
    }
    case Messages["/cosmwasm.wasm.v1.MsgExecuteContract"]: {
      try {
        const msgData = recordOf(msg.data);
        const rawMsg = msgData.msg;
        if (typeof rawMsg !== "string" && !(rawMsg instanceof Uint8Array)) {
          throw new Error("malformed contract execute payload");
        }
        const data = JSON.parse(Buffer.from(rawMsg).toString());
        const contract = stringOf(msgData.contract);

        if (data.open_lease) {
          const configStore = useConfigStore();
          const funds = firstCoinOf(msgData.funds);
          if (funds === undefined) {
            throw new Error("missing funds on open lease entry");
          }
          const token = getCurrency(funds);
          const protocolKey = getProtocolByContract(contract);
          const cr = getCurrencyByTickerForProtocol(data.open_lease.currency, protocolKey);
          const positionType = configStore.getPositionType(protocolKey);
          const steps = [
            {
              icon: NATIVE_NETWORK.icon
            },
            {
              icon: getIconByContract(contract)
            }
          ];

          if (positionType === "Short") {
            const lpn = getLpnByProtocol(protocolKey);

            return [
              t("message.open-short-position-action", {
                ticker: cr?.shortName,
                LPN_ticker: lpn?.shortName ?? "",
                position: t(`message.${positionType.toLowerCase()}`).toLowerCase(),
                amount: formatCoinPretty(token)
              }),
              token,
              {
                activeStep: steps.length,
                steps
              }
            ];
          }

          return [
            t("message.open-position-action", {
              ticker: cr?.shortName,
              position: t(`message.${positionType.toLowerCase()}`).toLowerCase(),
              amount: formatCoinPretty(token)
            }),
            token,
            {
              activeStep: steps.length,
              steps
            }
          ];
        }

        if (data.repay) {
          const funds = firstCoinOf(msgData.funds);
          if (funds === undefined) {
            throw new Error("missing funds on repay entry");
          }
          const token = getCurrency(funds);
          return [
            t("message.repay-position-action", {
              contract: truncateString(contract),
              amount: formatCoinPretty(token)
            }),
            token
          ];
        }

        if (data.close) {
          return [
            t("message.close-position-action", {
              contract: truncateString(contract)
            }),
            null
          ];
        }

        if (data.claim_rewards) {
          const reward = msg.rewards ? parseCoins(`${msg.rewards}`)[0] : undefined;
          const coin = reward === undefined ? "" : getCurrency(reward).toString();

          return [
            t("message.claim-position-action", {
              amount: coin,
              address: truncateString(contract)
            }),
            coin
          ];
        }

        if (data.deposit) {
          const funds = firstCoinOf(msgData.funds);
          if (funds === undefined) {
            throw new Error("missing funds on deposit entry");
          }
          const token = getCurrency(funds);
          return [
            t("message.supply-position-action", {
              amount: formatCoinPretty(token)
            }),
            token
          ];
        }

        if (data.burn) {
          const protocol = getProtocolByContract(contract);
          const lpn = getLpnByProtocol(protocol);
          if (!lpn) {
            return [formatMessageType(msg.type), null];
          }
          const txHash = msg.tx_hash;
          if (typeof txHash !== "string") {
            throw new Error("missing tx hash on withdraw entry");
          }
          const withdraw = await BackendApi.getLpWithdraw(txHash);
          const token = CurrencyUtils.convertMinimalDenomToDenom(
            withdraw.amount,
            lpn.ibcData,
            lpn.shortName,
            Number(lpn.decimal_digits)
          );
          return [
            t("message.withdraw-position-action", {
              amount: formatCoinPretty(token)
            }),
            token
          ];
        }

        if (data.close_position?.full_close) {
          return [
            t("message.full-close-action", {
              contract: truncateString(contract)
            }),
            null
          ];
        }
        if (data.change_close_policy) {
          return [
            t("message.change-close-policy", {
              address: truncateString(contract)
            }),
            null
          ];
        }

        if (data.close_position?.partial_close) {
          const currency = getCurrencyByTicker(data.close_position.partial_close.amount.ticker);
          const token = CurrencyUtils.convertMinimalDenomToDenom(
            data.close_position.partial_close.amount.amount,
            currency.ibcData,
            currency.shortName,
            Number(currency.decimal_digits)
          );

          return [
            t("message.partial-close-action", {
              ticker: data.close_position.currency,
              amount: formatCoinPretty(token),
              contract: truncateString(contract)
            }),
            token
          ];
        }
      } catch (error) {
        Logger.error(error);
        return [formatMessageType(msg.type), null];
      }

      return [formatMessageType(msg.type), null];
    }
    case Messages["/cosmos.gov.v1beta1.MsgVote"]: {
      const data = recordOf(msg.data);
      const option = data.option;
      const m = typeof option === "string" || typeof option === "number" ? voteMessages[option] : undefined;
      const proposalId = data.proposalId;
      return [
        t("message.vote-position-action", {
          vote: m,
          propose: proposalId === undefined || proposalId === null ? undefined : String(proposalId)
        }),
        null
      ];
    }
    case Messages["/cosmos.staking.v1beta1.MsgDelegate"]: {
      const data = recordOf(msg.data);
      const coin = coinOf(data.amount);
      if (coin === undefined) {
        console.error("[history] skipping MsgDelegate entry with malformed amount:", msg.tx_hash);
        return [formatMessageType(msg.type), null];
      }
      const token = getCurrency(coin);
      return [
        t("message.delegate-position-action", {
          validator: truncateString(stringOf(data.validatorAddress)),
          amount: formatCoinPretty(token)
        }),
        token
      ];
    }
    case Messages["/cosmos.staking.v1beta1.MsgUndelegate"]: {
      const data = recordOf(msg.data);
      const coin = coinOf(data.amount);
      if (coin === undefined) {
        console.error("[history] skipping MsgUndelegate entry with malformed amount:", msg.tx_hash);
        return [formatMessageType(msg.type), null];
      }
      const token = getCurrency(coin);
      return [
        t("message.undelegate-position-action", {
          validator: truncateString(stringOf(data.validatorAddress)),
          amount: formatCoinPretty(token)
        }),
        token
      ];
    }
    case Messages["/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"]: {
      const reward = msg.rewards ? parseCoins(`${msg.rewards}`)[0] : undefined;
      const coin = reward === undefined ? "" : getCurrency(reward).toString();

      return [
        t("message.claim-position-action", {
          amount: coin,
          address: truncateString(stringOf(recordOf(msg.data).validatorAddress))
        }),
        coin
      ];
    }
    case Messages["/cosmos.staking.v1beta1.MsgBeginRedelegate"]: {
      const data = recordOf(msg.data);
      const coin = coinOf(data.amount);
      if (coin === undefined) {
        console.error("[history] skipping MsgBeginRedelegate entry with malformed amount:", msg.tx_hash);
        return [formatMessageType(msg.type), null];
      }
      const token = getCurrency(coin);
      return [
        t("message.redelegate-action", {
          amount: formatCoinPretty(token),
          address: truncateString(stringOf(data.validatorDstAddress))
        }),
        token
      ];
    }
    default: {
      return [formatMessageType(stringOf(msg.typeUrl ?? msg.type)), null];
    }
  }
}

export function action(msg: IObjectKeys, i18n: IObjectKeys) {
  const t = translatorOf(i18n);
  switch (msg.type) {
    case Messages["/cosmos.bank.v1beta1.MsgSend"]: {
      return t("message.transfer-history");
    }
    case Messages["/ibc.applications.transfer.v1.MsgTransfer"]: {
      return msg.is_swap ? t("message.swap-history") : t("message.transfer-history");
    }
    case Messages["/ibc.core.channel.v1.MsgRecvPacket"]: {
      return msg.is_swap ? t("message.swap-history") : t("message.transfer-history");
    }
    case Messages["/cosmwasm.wasm.v1.MsgExecuteContract"]: {
      try {
        const rawMsg = recordOf(msg.data).msg;
        if (typeof rawMsg !== "string" && !(rawMsg instanceof Uint8Array)) {
          throw new Error("malformed contract execute payload");
        }
        const data = JSON.parse(Buffer.from(rawMsg).toString());
        if (data.open_lease) {
          return t("message.leases-history");
        }

        if (data.repay) {
          return t("message.leases-history");
        }

        if (data.close) {
          return t("message.leases-history");
        }

        if (data.claim_rewards) {
          return t("message.earn-history");
        }

        if (data.deposit) {
          return t("message.earn-history");
        }

        if (data.burn) {
          return t("message.earn-history");
        }

        if (data.close_position?.full_close) {
          return t("message.leases-history");
        }

        if (data.close_position?.partial_close) {
          return t("message.leases-history");
        }

        if (data.change_close_policy) {
          return t("message.close-policy");
        }
      } catch (error) {
        Logger.error(error);
        return formatMessageType(msg.type);
      }
      return formatMessageType(msg.type);
    }
    case Messages["/cosmos.gov.v1beta1.MsgVote"]: {
      return t("message.vote-history");
    }
    case Messages["/cosmos.staking.v1beta1.MsgDelegate"]: {
      return t("message.stake-history");
    }
    case Messages["/cosmos.staking.v1beta1.MsgUndelegate"]: {
      return t("message.stake-history");
    }
    case Messages["/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"]: {
      return t("message.stake-history");
    }
    case Messages["/cosmos.staking.v1beta1.MsgBeginRedelegate"]: {
      return t("message.stake-history");
    }
    default: {
      return formatMessageType(stringOf(msg.typeUrl ?? msg.type));
    }
  }
}

export function icon(msg: IObjectKeys, _i18n: IObjectKeys) {
  switch (msg.type) {
    case Messages["/cosmos.bank.v1beta1.MsgSend"]: {
      return "assets";
    }
    case Messages["/ibc.applications.transfer.v1.MsgTransfer"]: {
      return "assets";
    }
    case Messages["/ibc.core.channel.v1.MsgRecvPacket"]: {
      return "assets";
    }
    case Messages["/cosmwasm.wasm.v1.MsgExecuteContract"]: {
      try {
        const rawMsg = recordOf(msg.data).msg;
        if (typeof rawMsg !== "string" && !(rawMsg instanceof Uint8Array)) {
          throw new Error("malformed contract execute payload");
        }
        const data = JSON.parse(Buffer.from(rawMsg).toString());

        if (data.open_lease) {
          return "leases";
        }

        if (data.repay) {
          return "leases";
        }

        if (data.close) {
          return "leases";
        }

        if (data.claim_rewards) {
          return "earn";
        }

        if (data.deposit) {
          return "earn";
        }

        if (data.burn) {
          return "earn";
        }

        if (data.close_position?.full_close) {
          return "leases";
        }

        if (data.close_position?.partial_close) {
          return "leases";
        }
      } catch (error) {
        Logger.error(error);
        return "assets";
      }
      return "assets";
    }
    case Messages["/cosmos.gov.v1beta1.MsgVote"]: {
      return "vote";
    }
    case Messages["/cosmos.staking.v1beta1.MsgDelegate"]: {
      return "earn";
    }
    case Messages["/cosmos.staking.v1beta1.MsgUndelegate"]: {
      return "earn";
    }
    case Messages["/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"]: {
      return "earn";
    }
    case Messages["/cosmos.staking.v1beta1.MsgBeginRedelegate"]: {
      return "earn";
    }
    default: {
      return "assets";
    }
  }
}

/**
 * Convert a protobuf type URL to a human-readable label.
 * e.g. "/ibc.core.channel.v1.MsgRecvPacket" → "Recv Packet"
 *      "/cosmos.bank.v1beta1.MsgSend" → "Send"
 */
function formatMessageType(typeUrl: string): string {
  if (!typeUrl) return "Unknown";
  const parts = typeUrl.split(".");
  const msgName = parts[parts.length - 1];
  if (!msgName) return typeUrl;
  const withoutMsg = msgName.replace(/^Msg/, "");
  return withoutMsg.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function translatorOf(i18n: IObjectKeys): (key: string, values?: Record<string, unknown>) => string {
  const t = i18n.t;
  if (typeof t !== "function") {
    throw new Error("history formatting requires an i18n translate function");
  }
  return (key, values) => String(values === undefined ? t.call(i18n, key) : t.call(i18n, key, values));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function recordOf(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function stringOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function coinOf(value: unknown): Coin | undefined {
  if (isRecord(value) && typeof value.amount === "string" && typeof value.denom === "string") {
    return { amount: value.amount, denom: value.denom };
  }
  return undefined;
}

function firstCoinOf(value: unknown): Coin | undefined {
  return Array.isArray(value) ? coinOf(value[0]) : undefined;
}

function truncateString(text: string) {
  return TextFormat.truncateString(text, 6, 6);
}

function getCurrency(amount: Coin) {
  const info = tryGetCurrencyByDenom(amount.denom);
  return CurrencyUtils.convertMinimalDenomToDenom(
    amount?.amount,
    info?.ibcData ?? amount.denom,
    info?.shortName ?? truncateString(amount.denom),
    Number(info?.decimal_digits ?? 0)
  );
}

async function fetchCurrency(amount: Coin, symbol?: string) {
  const coin = tryGetCurrencyByDenom(amount.denom) ?? (symbol ? tryGetCurrencyBySymbol(symbol) : null);

  if (coin) {
    return CurrencyUtils.convertMinimalDenomToDenom(
      amount?.amount,
      coin.ibcData,
      coin.shortName ?? truncateString(amount.denom),
      Number(coin.decimal_digits ?? 0)
    );
  }

  try {
    const metadata = await BackendApi.getDenomMetadata(amount.denom);
    const resolved = metadata?.denom_units?.at(0);
    const currency = tryGetCurrencyBySymbol(resolved?.denom ?? amount.denom);

    if (currency) {
      return CurrencyUtils.convertMinimalDenomToDenom(
        amount?.amount,
        currency.ibcData,
        currency.shortName ?? truncateString(amount.denom),
        Number(currency.decimal_digits ?? 0)
      );
    }
  } catch (e) {
    console.error("[history] getDenomMetadata failed:", e);
  }

  return CurrencyUtils.convertMinimalDenomToDenom(amount?.amount, amount.denom, truncateString(amount.denom), 0);
}

function getChainName(address: string) {
  try {
    const decoded = bech32.decode(address);
    return decoded.prefix;
  } catch (error) {
    console.error("Invalid address format:", error);
    return null;
  }
}

function getIcon(prefix: string | null) {
  try {
    const configStore = useConfigStore();
    for (const network of Object.values(configStore.supportedNetworksData)) {
      if (network.prefix === prefix) {
        return network.icon;
      }
    }
  } catch (error) {
    console.error("Invalid address format:", error);
    return null;
  }
}

function getChainLabel(prefix: string | null) {
  try {
    const configStore = useConfigStore();
    for (const network of Object.values(configStore.supportedNetworksData)) {
      if (network.prefix === prefix) {
        return network.name;
      }
    }
  } catch (error) {
    console.error("Invalid address format:", error);
    return null;
  }
}

function getIconByContract(contract: string) {
  try {
    const configStore = useConfigStore();
    const protocol = getProtocolByContract(contract);
    return configStore.getNetworkIconByProtocol(protocol);
  } catch (error) {
    console.error("Invalid address format:", error);
    return null;
  }
}
