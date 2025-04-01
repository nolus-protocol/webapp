import type { IObjectKeys } from "@/common/types";
import { type Store } from "../types";
import { HYSTORY_ACTIONS } from "@/modules/history/types";
import { AssetUtils } from "@/common/utils/AssetUtils";
import { CurrencyUtils } from "@nolus/nolusjs";
import { getCreatedAtForHuman } from "@/common/utils";

export function updateHistory(this: Store, history: IObjectKeys, i18n: IObjectKeys) {
  const currency = AssetUtils.getCurrencyByDenom(history.currency);

  switch (history.type) {
    case HYSTORY_ACTIONS.RECEIVE: {
      const token = CurrencyUtils.convertMinimalDenomToDenom(
        history.skipRoute.amountOut,
        currency?.ibcData!,
        currency?.shortName!,
        Number(currency?.decimal_digits)
      );
      history.msg = i18n.t("message.receive-action", {
        amount: token.toString(),
        address: history.fromAddress
      });
      history.coin = token;
      break;
    }
    case HYSTORY_ACTIONS.SEND: {
      const token = CurrencyUtils.convertMinimalDenomToDenom(
        history.skipRoute.amountIn,
        currency?.ibcData!,
        currency?.shortName!,
        Number(currency?.decimal_digits)
      );
      history.msg = i18n.t("message.send-action", {
        amount: token.toString(),
        address: history.receiverAddress
      });
      history.coin = token;
      break;
    }
  }
  history.action = i18n.t("message.transfer-history");
  history.icon = "assets";
  history.timestamp = getCreatedAtForHuman(new Date());
  this.history[history.id] = history;
  console.log(history);
}
