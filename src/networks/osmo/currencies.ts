import nlsIcon from "@/assets/icons/coins/nls.svg";
import osmosisIcon from "@/assets/icons/coins/osmosis.svg";
import usdcIcon from "@/assets/icons/coins/usdc.svg";
import atomIcon from "@/assets/icons/coins/atom.svg";
import wethIcon from "@/assets/icons/coins/eth.svg";
import wbtcIcon from "@/assets/icons/coins/btc.svg";
import evmosIcon from "@/assets/icons/coins/evmos.svg";
import junoIcon from "@/assets/icons/coins/juno.svg";
import starsIcon from "@/assets/icons/coins/stars.svg";
import croIcon from "@/assets/icons/coins/cro.svg";
import scrtIcon from "@/assets/icons/coins/scrt.svg";

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
    USDC: {
        name: "Usdc",
        symbol: "uausdc",
        decimal_digits: "6",
        ibc_route: [
            "channel-1946"
        ],
        ticker: "USDC",
        icon: usdcIcon,
        native: false
    },
    ATOM: {
        name: "Atom",
        symbol: "uatom",
        decimal_digits: "6",
        ibc_route: [
            "channel-0"
        ],
        ticker: "ATOM",
        icon: atomIcon,
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
    // WETH: {
    //     name: "Ethereum WETH",
    //     symbol: "eth-wei",
    //     decimal_digits: "18",
    //     ibc_route: [
    //         "channel-144"
    //     ],
    //     ticker: "WETH",
    //     icon: wethIcon,
    //     native: false
    // },
    // WBTC: {
    //     name: "Bitcoin WBTC",
    //     symbol: "btc-satoshi",
    //     decimal_digits: "8",
    //     ibc_route: [
    //         "channel-208"
    //     ],
    //     ticker: "WBTC",
    //     icon: wbtcIcon,
    //     native: false
    // },
    // EVMOS: {
    //     name: "Evmos",
    //     symbol: "atevmos",
    //     decimal_digits: "18",
    //     ibc_route: [
    //         "channel-204"
    //     ],
    //     ticker: "EVMOS",
    //     icon: evmosIcon,
    //     native: false
    // },
    // JUNO: {
    //     name: "Juno",
    //     symbol: "ujuno",
    //     decimal_digits: "6",
    //     ibc_route: [
    //         "channel-169"
    //     ],
    //     ticker: "JUNO",
    //     icon: junoIcon,
    //     native: false
    // },
    // STARS: {
    //     name: "Stargaze",
    //     symbol: "ustars",
    //     decimal_digits: "6",
    //     ibc_route: [
    //         "channel-75"
    //     ],
    //     ticker: "STARS",
    //     icon: starsIcon,
    //     native: false
    // },
    // CRO: {
    //     name: "Crypto.org CRO",
    //     symbol: "basecro",
    //     decimal_digits: "8",
    //     ibc_route: [
    //         "channel-5"
    //     ],
    //     ticker: "CRO",
    //     icon: croIcon,
    //     native: false
    // },
    // SCRT: {
    //     name: "Secret SCRT",
    //     symbol: "uscrt",
    //     decimal_digits: "6",
    //     ibc_route: [
    //         "channel-88"
    //     ],
    //     ticker: "SCRT",
    //     icon: scrtIcon,
    //     native: false
    // },
}