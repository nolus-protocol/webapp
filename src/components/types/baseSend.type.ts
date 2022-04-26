import { AssetBalance } from "@/store";

export type BaseSendType = {
    currentBalance: AssetBalance[],
    selectedCurrency: AssetBalance,
    amount: string,
    memo: string,
    receiverAddress: string,
    password: string,
    onNextClick: () => void,
    onSendClick: () => void,
    onConfirmBackClick: () => void,
    onClickOkBtn: () => void,
}