import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { MsgDelegate, MsgUndelegate, MsgBeginRedelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { MsgVote } from "cosmjs-types/cosmos/gov/v1beta1/tx";
import { MsgTransfer as IbcMsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";

const td = new TextDecoder();

function parseUtf8Json(bytes?: Uint8Array): any {
  if (!bytes || bytes.length === 0) return {};
  try {
    return JSON.parse(td.decode(bytes));
  } catch {
    return {};
  }
}

export function reorderCoinsDeep(input: any): any {
  if (Array.isArray(input)) return input.map(reorderCoinsDeep);
  if (input && typeof input === "object") {
    const keys = Object.keys(input);
    const isCoin = keys.length === 2 && "denom" in input && "amount" in input;
    if (isCoin) return { amount: String(input.amount ?? "0"), denom: String(input.denom ?? "") };

    const out: Record<string, any> = {};
    for (const k of keys) out[k] = reorderCoinsDeep(input[k]);
    return out;
  }
  return input;
}

type ToLegacy = (bytes: Uint8Array) => { type: string; value: Record<string, unknown> };

const toLegacyByTypeUrl: Record<string, ToLegacy> = {
  "/cosmos.bank.v1beta1.MsgSend": (bytes) => {
    const m = MsgSend.decode(bytes);
    return {
      type: "cosmos-sdk/MsgSend",
      value: {
        amount: (m.amount ?? []).map((c) => ({ amount: c.amount, denom: c.denom })),
        from_address: m.fromAddress,
        to_address: m.toAddress
      }
    };
  },
  "/cosmos.staking.v1beta1.MsgDelegate": (bytes) => {
    const m = MsgDelegate.decode(bytes);
    return {
      type: "cosmos-sdk/MsgDelegate",
      value: {
        amount: { amount: m.amount?.amount, denom: m.amount?.denom },
        delegator_address: m.delegatorAddress,
        validator_address: m.validatorAddress
      }
    };
  },
  "/cosmos.staking.v1beta1.MsgUndelegate": (bytes) => {
    const m = MsgUndelegate.decode(bytes);
    return {
      type: "cosmos-sdk/MsgUndelegate",
      value: {
        amount: { amount: m.amount?.amount, denom: m.amount?.denom },
        delegator_address: m.delegatorAddress,
        validator_address: m.validatorAddress
      }
    };
  },
  "/cosmos.staking.v1beta1.MsgBeginRedelegate": (bytes) => {
    const m = MsgBeginRedelegate.decode(bytes);
    return {
      type: "cosmos-sdk/MsgBeginRedelegate",
      value: {
        amount: { amount: m.amount?.amount, denom: m.amount?.denom },
        delegator_address: m.delegatorAddress,
        validator_src_address: m.validatorSrcAddress,
        validator_dst_address: m.validatorDstAddress
      }
    };
  },
  "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward": (bytes) => {
    const m = MsgWithdrawDelegatorReward.decode(bytes);
    return {
      type: "cosmos-sdk/MsgWithdrawDelegationReward",
      value: {
        delegator_address: m.delegatorAddress,
        validator_address: m.validatorAddress
      }
    };
  },
  "/cosmos.gov.v1beta1.MsgVote": (bytes) => {
    const m = MsgVote.decode(bytes);
    return {
      type: "cosmos-sdk/MsgVote",
      value: {
        option: m.option,
        proposal_id: m.proposalId?.toString?.() ?? "0",
        voter: m.voter
      }
    };
  },
  "/ibc.applications.transfer.v1.MsgTransfer": (bytes) => {
    const m = IbcMsgTransfer.decode(bytes);
    const timeoutHeight =
      m.timeoutHeight && (m.timeoutHeight.revisionHeight !== BigInt(0) || m.timeoutHeight.revisionNumber !== BigInt(0))
        ? {
            revision_number: m.timeoutHeight.revisionNumber?.toString?.() ?? "0",
            revision_height: m.timeoutHeight.revisionHeight?.toString?.() ?? "0"
          }
        : {};

    const value = {
      memo: m.memo ?? "",
      receiver: m.receiver,
      sender: m.sender,
      source_channel: m.sourceChannel,
      source_port: m.sourcePort,
      timeout_height: timeoutHeight,
      timeout_timestamp: m.timeoutTimestamp?.toString?.() ?? "0",
      token: m.token
        ? {
            amount: m.token.amount,
            denom: m.token.denom
          }
        : undefined
    };

    return {
      type: "cosmos-sdk/MsgTransfer",
      value
    };
  },
  "/cosmwasm.wasm.v1.MsgExecuteContract": (bytes) => {
    const m = MsgExecuteContract.decode(bytes);

    return {
      type: "wasm/MsgExecuteContract",
      value: {
        contract: m.contract,
        funds: (m.funds ?? []).map((c) => ({ amount: c.amount, denom: c.denom })),
        msg: parseUtf8Json(m.msg),
        sender: m.sender
      }
    };
  }
};

export function anyToLegacy(anyMsg: { typeUrl: string; value: Uint8Array }) {
  const fn = toLegacyByTypeUrl[anyMsg.typeUrl];
  if (!fn) {
    throw new Error(`Unregistered typeUrl: ${anyMsg.typeUrl}`);
  }
  const out = fn(anyMsg.value);
  return { type: out.type, value: reorderCoinsDeep(out.value) };
}
