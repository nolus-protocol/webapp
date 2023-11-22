import type { EIP1193Provider, Web3APISpec } from "web3";

export interface Window {
    ethereum?: EIP1193Provider<Web3APISpec>
}
