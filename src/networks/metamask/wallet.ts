import ABI from "./erc20.abi.json";
import type { Window as MetamaskWindow } from "./window";
import { Contract, ethers, isAddress } from "ethers";
import type { Wallet } from "../wallet";
import type { IObjectKeys } from "@/common/types";
import { Logger } from "@/common/utils";

const confirmations = 1;

export class MetaMaskWallet implements Wallet {
  web3!: ethers.BrowserProvider;
  address!: string;
  shortAddress!: string;
  rpc!: string;
  chainId!: string;
  accountChangeCallback!: Function | null;

  async connect(config: IObjectKeys, accountChangeCallback?: Function) {
    const metamask = (window as MetamaskWindow).ethereum;
    this.accountChangeCallback = accountChangeCallback as Function | null;
    if (metamask) {
      try {
        this.web3 = new ethers.BrowserProvider((window as MetamaskWindow).ethereum);

        await this.switchNetwork(config);

        const addr = await this.web3.send("eth_requestAccounts", []);
        this.setAccount(addr[0]);
        this.rpc = config.rpcUrls[0];
        this.chainId = config.chainId;

        (window as IObjectKeys).ethereum.on("accountsChanged", this.toggleAccounts);
      } catch (e: Error | any) {
        throw new Error(e);
      }
    }
  }

  async switchNetwork(config: IObjectKeys) {
    try {
      await this.web3.send("wallet_switchEthereumChain", [{ chainId: config.chainId }]);
    } catch (error: Error | any) {
      if (error?.error?.code == 4902) {
        this.addNetwork(config);
      }
    }
  }

  async addNetwork(config: IObjectKeys) {
    try {
      await this.web3.send("wallet_addEthereumChain", [{ ...config }]);
    } catch (error: Error | any) {
      Logger.error(error);
    }
  }

  toggleAccounts = (accounts: string[]) => {
    this.setAccount(accounts[0]);
    if (this.accountChangeCallback) {
      this.accountChangeCallback();
    }
  };

  getSigner() {
    return this.web3.getSigner();
  }

  private setAccount(addr: string) {
    this.address = addr;
    const first = this.address.slice(0, 7);
    const last = this.address.slice(this.address.length - 4, this.address.length);
    this.shortAddress = `${first}...${last}`;
  }

  destroy() {
    (window as IObjectKeys).ethereum.removeListener("accountsChanged", this.toggleAccounts);
    this.web3.destroy();
  }

  async setApprove({ amount, spender, tokenContract }: { amount: string; spender: string; tokenContract: string }) {
    const signer = await this.getSigner();
    const contract = new ethers.Contract(tokenContract, ABI, signer);
    const data = await contract.approve(spender, amount);
    await this.web3.waitForTransaction(data.hash, confirmations);
  }

  async getChainId(rpc?: string) {
    const data = await fetch(this.rpc ?? rpc, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ method: "eth_chainId", params: [], id: 1, jsonrpc: "2.0" })
    });
    const json = (await data.json()) as IObjectKeys;
    return json.result;
  }

  async getContractBalance(contractAddress: string): Promise<string> {
    if (this.address) {
      const address = this.address;
      const contract = new Contract(contractAddress, ABI, this.web3);

      return (await contract.balanceOf(address)).toString();
    }

    return "0";
  }

  async getBalance() {
    return this.web3.getBalance(this.address);
  }

  static isValidAddress(address: string) {
    return isAddress(address);
  }
}
