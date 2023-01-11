import type { StdFee } from "@cosmjs/stargate";
import { Dec, Int } from "@keplr-wallet/unit";
import { ChainConstants } from "@nolus/nolusjs/build/constants";
import { WalletUtils } from "@/utils";

export const FEE = "0.25";

export const defaultNolusWalletFee = (): StdFee => {
  const coinDecimals = new Int(10).pow(
    new Int(ChainConstants.COIN_DECIMALS).absUInt()
  );
  const feeAmount = new Dec(FEE).mul(new Dec(coinDecimals));
  return {
    amount: [
      {
        denom: ChainConstants.COIN_MINIMAL_DENOM,
        amount: WalletUtils.isConnectedViaExtension()
          ? FEE
          : feeAmount.truncate().toString(),
      },
    ],
    gas: "2000000",
  };
};
