import ABI from './erc20.abi.json';
import type { Window as MetamaskWindow } from './window';
import { Contract, ethers } from 'ethers';

const NATIVE_ASSET = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export class MetaMaskWallet {

    web3!: ethers.providers.Web3Provider;
    address!: string;
    shortAddress!: string;

    async connect(config: Object, rpc: string) {
        const metamask = (window as MetamaskWindow).ethereum;

        if (metamask) {
            try {
                this.web3 = new ethers.providers.Web3Provider(metamask!)
                await this.web3.send('wallet_addEthereumChain', [{ ...config }]);

                const addr = await this.web3.send('eth_requestAccounts', []);
                this.address = addr[0];
                const first = this.address.slice(0, 7);
                const last = this.address.slice(this.address.length - 4, this.address.length);
                this.shortAddress = `${first}...${last}`;

            } catch (e: Error | any) {
                throw new Error(e);
            }
        }

    }

    getSigner(){
        return this.web3.getSigner();
    }

    async getContractBalance(contractAddress: string): Promise<string> {
        if (this.address) {

            const address = this.address;

            if (contractAddress == NATIVE_ASSET) {
                return (await this.web3.getBalance(this.address)).toString();
            }

            const contract = new Contract(contractAddress, ABI, this.web3)

            return (await contract.balanceOf(address)).toString();
        }

        return '0';

    }
}