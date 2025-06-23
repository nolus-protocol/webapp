import type { Store } from "../types";
import type { AccountData, DirectSignResponse, OfflineDirectSigner } from "@cosmjs/proto-signing";
import type { SignDoc as ProtoSignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";

import SignClient from "@walletconnect/sign-client";
import { AppUtils, WalletManager } from "@/common/utils";
import { ChainConstants, NolusClient, NolusWalletFactory } from "@nolus/nolusjs";
import { WalletConnectMechanism } from "@/common/types";
import { Buffer } from "buffer";
import { Intercom } from "@/common/utils/Intercom";
import { toBase64, fromBase64 } from "@cosmjs/encoding";
import { getDeviceInfo } from "@/common/utils/Device";
import { WalletConnectName } from "@/config/global";

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

export async function connectWithWalletConnect(this: Store, callback?: Function) {
  const { signer, signClient, session, chainId } = await getWalletConnectOfflineSigner(callback);

  const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(signer);
  await nolusWalletOfflineSigner.useAccount();
  const key = await signClient.request<
    {
      address: string;
      pubkey: string;
    }[]
  >({
    topic: session.topic,
    chainId: `cosmos:${chainId}`,
    request: { method: "cosmos_getAccounts", params: { chainId } }
  });

  const w = key[0];
  WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.WALLET_WC);
  WalletManager.setPubKey(Buffer.from(w.pubkey, "base64").toString("hex"));

  this.wallet = nolusWalletOfflineSigner;
  this.walletName = WalletConnectName;
  await this.UPDATE_BALANCES();
  this.loadActivities();
  Intercom.load(this.wallet.address);
}

export async function getWalletConnectOfflineSigner(callback?: Function, chId?: string) {
  const networkConfig = await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);

  if (!chId) {
    NolusClient.setInstance(networkConfig.rpc);
    chId = await NolusClient.getInstance().getChainId();
  }

  const signClient = await getClient();
  await signClient.auth.init();

  await signClient.session.init();

  signClient.on("session_request", (...args) => console.log(args));
  let session = signClient.session.getAll().at(-1);

  if (!session) {
    const chains = [];
    const chainsIds = await AppUtils.getChainIds();

    for (const key in chainsIds.cosmos) {
      chains.push(`cosmos:${chainsIds.cosmos[key]}`);
    }
    const { uri, approval } = await signClient.connect({
      optionalNamespaces: {
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
          chains: chains,
          events: ["accountsChanged", "chainChanged", "keplr_accountsChanged"]
        }
      }
    });

    WalletManager.setWCuri(uri);
    redirect(uri, callback);

    session = await approval();
  }

  const signer = makeWCOfflineSigner(signClient, session.topic, `cosmos:${chId}`);
  return {
    signer,
    signClient,
    session,
    chainId: chId
  };
}

export function redirect(uri?: string, callback?: Function) {
  try {
    const device = getDeviceInfo();
    switch (device.os) {
      case "Android": {
        const universalURL = `intent://wcV2?${uri}#Intent;package=com.chainapsis.keplr;scheme=keplrwallet;end;`;
        window.location.href = universalURL;
        break;
      }
      case "iOS": {
        const universalURL = `keplrwallet://wcV2?${uri}`;
        window.location.href = universalURL;
        break;
      }
      default: {
        callback?.(uri);
        break;
      }
    }
  } catch (e: Error | any) {
    console.error(e);
  }
}

export function makeWCOfflineSigner(
  signClient: SignClient,
  sessionTopic: string,
  cosmosNamespace: string
): OfflineDirectSigner {
  return {
    async getAccounts(): Promise<readonly AccountData[]> {
      const [accounts] = await Promise.all([
        signClient.request({
          topic: sessionTopic,
          chainId: cosmosNamespace,
          request: { method: "cosmos_getAccounts", params: {} }
        }) as Promise<Array<{ address: string; algo: string; pubkey: string }>>,
        redirect(WalletManager.getWCuri() ?? undefined)
      ]);

      const data = accounts.map(({ address, algo, pubkey }) => ({
        address,
        algo,
        pubkey: fromBase64(pubkey)
      })) as AccountData[];
      return data;
    },

    async signDirect(signerAddress: string, signDoc: ProtoSignDoc): Promise<DirectSignResponse> {
      const base64Doc = {
        chainId: signDoc.chainId,
        accountNumber: signDoc.accountNumber.toString(),
        authInfoBytes: toBase64(signDoc.authInfoBytes),
        bodyBytes: toBase64(signDoc.bodyBytes)
      };

      const [resp] = await Promise.all([
        signClient.request<{
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
        }),
        redirect(WalletManager.getWCuri() ?? undefined)
      ]);

      const normalize = (input: string | Uint8Array): Uint8Array =>
        typeof input === "string" ? fromBase64(input) : input;

      const signedAuthInfoBytes = normalize(resp.signed.authInfoBytes);
      const signedBodyBytes = normalize(resp.signed.bodyBytes);
      const pubkeyBytes = normalize(resp.signature.pub_key.value);

      return {
        signed: {
          chainId: resp.signed.chainId,
          accountNumber: BigInt(resp.signed.accountNumber),
          authInfoBytes: signedAuthInfoBytes,
          bodyBytes: signedBodyBytes
        },
        signature: {
          pub_key: {
            type: resp.signature.pub_key.type,
            value: pubkeyBytes
          },
          signature: resp.signature.signature as string
        }
      };
    }
  };
}
