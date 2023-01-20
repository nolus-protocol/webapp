import nlsIcon from "@/assets/icons/coins/nls.svg";
import osmosisIcon from "@/assets/icons/coins/osmosis.svg";

export const CURRENCIES = {
    NLS: {
        name: "Nolus",
        symbol: "unls",
        decimal_digits: "6",
        ibc_route: ["channel-1837"],
        ticker: "NLS",
        icon: nlsIcon,
        native: false
    },
    OSMO: {
        name: "Osmosis OSMO",
        symbol: "uosmo",
        decimal_digits: "6",
        ibc_route: [],
        ticker: "OSMO",
        icon: osmosisIcon,
        native: true
    },
}