export { BaseWallet } from './BaseWallet';
export { Wallet } from './Wallet';
export { aminoTypes, createWallet, authenticateKeplr, authenticateLeap, authenticateLedger, authenticateDecrypt } from './WalletFactory';
export { NETWORKS_DATA, SUPPORTED_NETWORKS } from './config';

// export const NETWORKS_CURRENCIES: {
//     [key: string]: Function
// } = {
//     osmo: () => () => {
//         import('./osmo/currencies').then((m) => m.CURRENCIES)
//     }
// }