import { CurrencyMapping } from "@/config/global";
import { useApplicationStore } from "../../application";

//TODO: delete or refactor
export function getCurrencyByTicker() {
  const app = useApplicationStore();
  return (ticker?: string) => {
    if (!ticker) {
      return undefined;
    }

    for (const key in CurrencyMapping) {
      if (CurrencyMapping[key].ticker == ticker) {
        ticker = key;
        break;
      }
    }

    for (const currency in app.currenciesData) {
      const [t] = currency.split("@");
      if (t == ticker) {
        return app.currenciesData![currency];
      }
    }
  };
}
