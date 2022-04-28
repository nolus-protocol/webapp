import { AssetBalance } from "@/store";

export interface BaseSendPropsType {
    currentBalance: AssetBalance[];
    selectedCurrency: AssetBalance;
    amount: string;
    memo: string;
    receiverAddress: string;
    password: string;
    onNextClick:() => void;
    onSendClick:() => void;
    onConfirmBackClick:() => void;
    onClickOkBtn:() => void;
}
