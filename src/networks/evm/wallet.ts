import type { Wallet } from "../wallet";

export class MetaMaskWallet implements Wallet {
  address!: string;
  explorer: string;

  constructor(explorer: string) {
    this.explorer = explorer;
  }
}
