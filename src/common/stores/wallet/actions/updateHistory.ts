import { CONFIRM_STEP, type IObjectKeys } from "@/common/types";
import { type Store } from "../types";
import { HYSTORY_ACTIONS } from "@/modules/history/types";
import { AssetUtils } from "@/common/utils/AssetUtils";
import { CurrencyUtils } from "@nolus/nolusjs";
import { StringUtils } from "@/common/utils";
import { Dec } from "@keplr-wallet/unit";
import { h } from "vue";

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
        address: StringUtils.truncateString(history.fromAddress, 6, 6)
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
        address: StringUtils.truncateString(history.receiverAddress, 6, 6)
      });
      history.coin = token;
      break;
    }
  }
  history.action = i18n.t("message.transfer-history");
  history.icon = "assets";
  history.routeDetails = {
    steps: getSteps(history.skipRoute, i18n, currency, history.chains),
    activeStep: 0
  };
  history.route = {
    steps: getSteps(history.skipRoute, i18n, currency, history.chains),
    activeStep: 0
  };
  history.status = CONFIRM_STEP.PENDING;
  this.history[history.id] = {
    historyData: history
  };
}

function getSteps(route: IObjectKeys, i18n: IObjectKeys, currency: IObjectKeys, chains: IObjectKeys[]) {
  const stps = [];
  for (const [index, operation] of (route?.operations ?? []).entries()) {
    if (operation.transfer || operation.cctpTransfer) {
      const op = operation.transfer ?? operation.cctpTransfer;
      const from = chains[op.fromChainId];
      const to = chains[op.toChainId];
      let label = i18n.t("message.send-stepper");

      if (index > 0 && index < route?.operations.length) {
        label = i18n.t("message.swap-stepper");
      }

      stps.push({
        label,
        icon: from.icon,
        token: {
          balance: AssetUtils.formatNumber(
            new Dec(index == 0 ? operation.amountIn : operation.amountOut, currency?.decimal_digits).toString(
              currency?.decimal_digits
            ),
            currency?.decimal_digits
          ),
          symbol: currency?.shortName
        },
        meta: () => h("div", `${from.label} > ${to.label}`)
      });

      if (index == route?.operations.length - 1) {
        stps.push({
          label: i18n.t("message.receive-stepper"),
          icon: to.icon,
          token: {
            balance: AssetUtils.formatNumber(
              new Dec(operation.amountOut, currency?.decimal_digits).toString(currency?.decimal_digits),
              currency?.decimal_digits
            ),
            symbol: currency?.shortName
          },
          meta: () => h("div", `${to.label}`)
        });
      }
    }
  }

  return stps;
}
