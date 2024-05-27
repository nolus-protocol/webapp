import ABI from "./erc20.abi.json";
import type { Window as MetamaskWindow } from "./window";
import { Contract, ethers, isAddress } from "ethers";
import type { Wallet } from "../wallet";
import type { IObjectKeys } from "@/common/types";

export class MetaMaskWallet implements Wallet {
  web3!: ethers.BrowserProvider;
  address!: string;
  shortAddress!: string;
  rpc!: string;
  chainId!: string;

  async connect(config: IObjectKeys) {
    const metamask = (window as MetamaskWindow).ethereum;

    if (metamask) {
      try {
        this.web3 = new ethers.BrowserProvider((window as MetamaskWindow).ethereum);
        await this.web3.send("wallet_addEthereumChain", [{ ...config }]);

        const addr = await this.web3.send("eth_requestAccounts", []);
        this.address = addr[0];
        const first = this.address.slice(0, 7);
        const last = this.address.slice(this.address.length - 4, this.address.length);
        this.shortAddress = `${first}...${last}`;
        this.rpc = config.rpcUrls[0];
        this.chainId = config.chainId;
      } catch (e: Error | any) {
        throw new Error(e);
      }
    }
  }

  getSigner() {
    return this.web3.getSigner();
  }

  destroy() {
    this.web3.destroy();
  }

  async getChainId(rpc?: string) {
    const data = await fetch(this.rpc ?? rpc, {
      method: "POST",
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
