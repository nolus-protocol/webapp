import type { Store } from "../types";

import { AppUtils, WalletManager } from "@/common/utils";
import { ChainConstants, NolusClient, NolusWalletFactory } from "@nolus/nolusjs";
import { WalletConnectMechanism } from "@/common/types";
import { Buffer } from "buffer";
import { Intercom } from "@/common/utils/Intercom";
import SignClient from "@walletconnect/sign-client";
import type { AccountData, DirectSignResponse, OfflineDirectSigner } from "@cosmjs/proto-signing";
import type { SignDoc as ProtoSignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { toBase64, fromBase64 } from "@cosmjs/encoding";

let client: Promise<SignClient> | undefined;

function getClient(): Promise<SignClient> {
  if (!client) {
    client = SignClient.init({
      projectId: "3effa9b81e6b6bea7da5022096ea8c68",
      metadata: {
        name: "Nolus",
        description:
          "Nolus Protocol is a Web3 financial suite that offers an innovative approach to money markets with a novel lease solution to further develop the DeFi space",
        url: window.location.origin,
        icons: [
          "https://raw.githubusercontent.com/nolus-protocol/webapp/refs/heads/main/src/assets/icons/networks/nolus.svg"
        ]
      }
    });
  }
  return client!;
}

export async function connectWithWalletConnect(this: Store) {
  const networkConfig = await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);
  NolusClient.setInstance(networkConfig.rpc);
  const chainId = "pirin-1";
  console.log(chainId);
  const signClient = await getClient();
  await signClient.auth.init();

  await signClient.session.init();

  signClient.on("session_request", (...args) => console.log(args));
  let session = signClient.session.getAll().at(-1);
  if (!session) {
    const { uri, approval } = await signClient.connect({
      requiredNamespaces: {
        cosmos: {
          methods: [
            "cosmos_getAccounts",
            "cosmos_signDirect",
            "cosmos_signAmino",
            "keplr_getKey",
            "keplr_signAmino",
            "keplr_signDirect",
            "keplr_signArbitrary",
            "keplr_enable",
            "keplr_signEthereum",
            "keplr_experimentalSuggestChain",
            "keplr_suggestToken"
          ],
          chains: [`cosmos:${chainId}`, "cosmos:osmosis-1"],
          events: ["accountsChanged", "chainChanged", "keplr_accountsChanged"]
        }
      }
    });
    console.log(uri);

    //TODO: remove in prod crate for ios link
    // const universalURL = `intent://wcV2?${encoded}#Intent;package=com.chainapsis.keplr;scheme=keplrwallet;end;`;
    // window.location.href = universalURL;
    session = await approval();
  }

  // const ping = await signClient.ping({ topic: session.topic });

  // const result = await signClient.request({
  //   topic: session!.topic,
  //   chainId: `cosmos:${chainId}`,
  //   request: {
  //     method: "cosmos_getAccounts",
  //     params: {}
  //   }
  // });

  const signer = makeWCOfflineSigner(signClient, session.topic, `cosmos:${chainId}`);
  // const offlinesigner = await SigningStargateClient.connectWithSigner(networkConfig.rpc, signer);
  // console.log(offlinesigner);
  const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(signer);
  await nolusWalletOfflineSigner.useAccount();
  const key = await signClient.request<
    {
      address: string;
      pubkey: string; // base64
    }[]
  >({
    topic: session.topic,
    chainId: `cosmos:${chainId}`,
    request: { method: "cosmos_getAccounts", params: { chainId } }
  });

  const w = key[0];
  WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.WALLET_WC);
  WalletManager.setPubKey(Buffer.from(w.pubkey, "base64").toString("hex"));
  console.log(w);

  this.wallet = nolusWalletOfflineSigner;
  this.walletName = "WalletConnect";
  await this.UPDATE_BALANCES();
  this.loadActivities();
  Intercom.load(this.wallet.address);
}

function makeWCOfflineSigner(
  signClient: SignClient,
  sessionTopic: string,
  cosmosNamespace: string // e.g. "cosmos:pirin-1"
): OfflineDirectSigner {
  return {
    async getAccounts(): Promise<readonly AccountData[]> {
      const accounts: Array<{ address: string; algo: string; pubkey: string }> = await signClient.request({
        topic: sessionTopic,
        chainId: cosmosNamespace,
        request: { method: "cosmos_getAccounts", params: {} }
      });
      return accounts.map(({ address, algo, pubkey }) => ({
        address,
        algo,
        pubkey: fromBase64(pubkey)
      }));
    },

    async signDirect(signerAddress: string, signDoc: ProtoSignDoc): Promise<DirectSignResponse> {
      const base64Doc = {
        chainId: signDoc.chainId,
        accountNumber: signDoc.accountNumber.toString(),
        authInfoBytes: toBase64(signDoc.authInfoBytes),
        bodyBytes: toBase64(signDoc.bodyBytes)
      };

      const resp = await signClient.request<{
        signed: {
          chainId: string;
          accountNumber: string;
          authInfoBytes: string | Uint8Array;
          bodyBytes: string | Uint8Array;
        };
        signature: {
          pub_key: { type: string; value: string | Uint8Array };
          signature: string | Uint8Array;
        };
      }>({
        topic: sessionTopic,
        chainId: cosmosNamespace,
        request: {
          method: "cosmos_signDirect",
          params: { signerAddress, signDoc: base64Doc }
        }
      });

      const normalize = (input: string | Uint8Array): Uint8Array =>
        typeof input === "string" ? fromBase64(input) : input;

      const signedAuthInfoBytes = normalize(resp.signed.authInfoBytes);
      const signedBodyBytes = normalize(resp.signed.bodyBytes);
      const pubkeyBytes = normalize(resp.signature.pub_key.value);

      return {
        signed: {
          chainId: resp.signed.chainId,
          accountNumber: resp.signed.accountNumber,
          authInfoBytes: signedAuthInfoBytes,
          bodyBytes: signedBodyBytes
        },
        signature: {
          pub_key: {
            type: resp.signature.pub_key.type,
            value: pubkeyBytes
          },
          signature: resp.signature.signature
        }
      };
    }
  };
}
