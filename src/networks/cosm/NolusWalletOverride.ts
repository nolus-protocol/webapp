/**
 * NolusWallet overrides
 *
 * Patches a NolusWallet instance to:
 * 1. Use cached gas prices from the backend instead of querying the chain's tax module
 * 2. Use backend-configured gas multiplier instead of hardcoded ChainConstants.GAS_MULTIPLIER
 */

import { useConfigStore } from "@/common/stores/config";
import { encodeSecp256k1Pubkey } from "@cosmjs/amino";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { toHex } from "@cosmjs/encoding";
import { sha256 } from "@cosmjs/crypto";

/**
 * Get the gas multiplier from the backend config.
 * Throws if not available (fail loudly — no fallbacks).
 */
function getGasMultiplier(): number {
  const configStore = useConfigStore();
  const feeConfig = configStore.gasFeeConfig;

  if (!feeConfig) {
    throw new Error("Gas fee config not available from backend");
  }

  return feeConfig.gas_multiplier;
}

export function applyNolusWalletOverrides(wallet: any): void {
  // Override gasPrices — use backend-cached gas prices instead of chain query
  wallet.gasPrices = async (): Promise<{ [denom: string]: number }> => {
    const configStore = useConfigStore();
    const feeConfig = configStore.gasFeeConfig;

    if (!feeConfig) {
      throw new Error("Gas fee config not available from backend");
    }

    const prices: { [denom: string]: number } = {};
    for (const [denom, price] of Object.entries(feeConfig.gas_prices)) {
      prices[denom] = Number(price);
    }
    return prices;
  };

  // Override simulateTx — use backend gas_multiplier instead of ChainConstants.GAS_MULTIPLIER
  wallet.simulateTx = async function (msg: any, msgTypeUrl: string, memo = "") {
    // Ledger/hardware wallet delegation
    if (wallet.offlineSigner.simulateTx) {
      return wallet.offlineSigner.simulateTx(msg, memo);
    }

    const gasMultiplier = getGasMultiplier();
    const pubkey = encodeSecp256k1Pubkey(wallet.pubKey);
    const msgAny = { typeUrl: msgTypeUrl, value: msg };
    const { sequence } = await wallet.sequence();
    const { gasInfo } = await wallet
      .forceGetQueryClient()
      .tx.simulate([wallet.registry.encodeAsAny(msgAny)], memo, pubkey, sequence);
    const gas = Math.round(Number(gasInfo?.gasUsed ?? 0) * gasMultiplier);
    const usedFee = await wallet.selectDynamicFee(gas, [{ msg, msgTypeUrl }]);
    const txRaw = await wallet.sign(wallet.address, [msgAny], usedFee, memo);
    const txBytes = Uint8Array.from(TxRaw.encode(txRaw).finish());
    const txHash = toHex(sha256(txBytes));
    return { txHash, txBytes, usedFee };
  };

  // Override simulateMultiTx — use backend gas_multiplier instead of ChainConstants.GAS_MULTIPLIER
  wallet.simulateMultiTx = async function (messages: any[], memo = "") {
    // Ledger/hardware wallet delegation
    if (wallet.offlineSigner.simulateMultiTx) {
      return wallet.offlineSigner.simulateMultiTx(messages, memo);
    }

    const gasMultiplier = getGasMultiplier();
    const pubkey = encodeSecp256k1Pubkey(wallet.pubKey);
    const encodedMSGS: any[] = [];
    const msgs: any[] = [];
    for (const item of messages) {
      const msgAny = { typeUrl: item.msgTypeUrl, value: item.msg };
      encodedMSGS.push(wallet.registry.encodeAsAny(msgAny));
      msgs.push(msgAny);
    }
    const { sequence } = await wallet.sequence();
    const { gasInfo } = await wallet.forceGetQueryClient().tx.simulate(encodedMSGS, memo, pubkey, sequence);
    const gas = Math.round(Number(gasInfo?.gasUsed ?? 0) * gasMultiplier);
    const usedFee = await wallet.selectDynamicFee(gas, messages);
    const txRaw = await wallet.sign(wallet.address, msgs, usedFee, memo);
    const txBytes = Uint8Array.from(TxRaw.encode(txRaw).finish());
    const txHash = toHex(sha256(txBytes));
    return { txHash, txBytes, usedFee };
  };

  // Override getGasInfo — also uses gas multiplier for fee estimation
  wallet.getGasInfo = async function (messages: any[], memo: string, pubkey: any, sequence: number) {
    const gasMultiplier = getGasMultiplier();
    const encodedMSGS: any[] = [];
    for (const item of messages) {
      const msgAny = { typeUrl: item.msgTypeUrl, value: item.msg };
      encodedMSGS.push(wallet.registry.encodeAsAny(msgAny));
    }
    const { gasInfo } = await wallet.forceGetQueryClient().tx.simulate(encodedMSGS, memo, pubkey, sequence);
    const gas = Math.round(Number(gasInfo?.gasUsed ?? 0) * gasMultiplier);
    const usedFee = await wallet.selectDynamicFee(gas, messages);
    return { gasInfo, gas, usedFee };
  };
}
