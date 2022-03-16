import { OfflineDirectSigner } from '@cosmjs/proto-signing'
import { NolusWallet } from '@/wallet/NolusWallet'
import { BECH32_PREFIX_ACC_ADDR } from '@/constants/chain'
import { NolusClient } from '@/client/NolusClient'
import { LedgerSigner } from '@cosmjs/ledger-amino'

export const nolusOfflineSigner = async (offlineDirectSigner: OfflineDirectSigner): Promise<NolusWallet> => {
  const tendermintClient = await NolusClient.getInstance().getTendermintClient()
  return new NolusWallet(tendermintClient, offlineDirectSigner, { prefix: BECH32_PREFIX_ACC_ADDR })
}

export const nolusLedgerWallet = async (ledgerSigner: LedgerSigner): Promise<NolusWallet> => {
  const tendermintClient = await NolusClient.getInstance().getTendermintClient()
  return new NolusWallet(tendermintClient, ledgerSigner, { prefix: BECH32_PREFIX_ACC_ADDR })
}
