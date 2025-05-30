import { type Store } from "../types";
import { EtlApi, getCreatedAtForHuman } from "@/common/utils";
import { action, icon as iconFn, message } from "@/modules/history/common";
import { i18n } from "@/i18n";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1/gov";

export async function loadActivities(this: Store) {
  try {
    if (this.wallet?.address) {
      const voteMessages: { [key: string]: string } = {
        [VoteOption.VOTE_OPTION_ABSTAIN]: i18n.global.t(`message.abstained`).toLowerCase(),
        [VoteOption.VOTE_OPTION_NO_WITH_VETO]: i18n.global.t(`message.veto`).toLowerCase(),
        [VoteOption.VOTE_OPTION_YES]: i18n.global.t(`message.yes`).toLowerCase(),
        [VoteOption.VOTE_OPTION_NO]: i18n.global.t(`message.no`).toLowerCase()
      };

      this.activities.loaded = false;
      const res = await EtlApi.fetchTXS(this.wallet?.address, 0, 10).then((data) => {
        const promises = [];
        for (const d of data) {
          const fn = async () => {
            const [msg, coin, route, routeDetails] = await message(d, this.wallet?.address, i18n.global, voteMessages);
            d.historyData = {
              msg,
              coin,
              action: action(d, i18n.global).toLowerCase(),
              icon: iconFn(d, i18n.global).toLowerCase(),
              timestamp: getCreatedAtForHuman(d.timestamp),
              route,
              routeDetails
            };
            return d;
          };
          promises.push(fn());
        }
        return Promise.all(promises);
      });
      this.activities = { data: res, loaded: true };
    } else {
      this.activities = { data: [], loaded: true };
    }
  } catch (e: Error | any) {
  } finally {
    this.activities.loaded = true;
  }
}
