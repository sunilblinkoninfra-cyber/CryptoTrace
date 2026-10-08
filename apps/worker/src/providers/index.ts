// createWorkerProvider -- Builds the activity provider stack used by async trace jobs.
import { createDefaultActivityProvider, type ActivityProvider } from "@kadenatrace/shared";

export function createWorkerProvider(): ActivityProvider {
  return createDefaultActivityProvider({
    covalentApiKey: process.env.COVALENT_API_KEY,
    ethereumRpcUrl: process.env.ETHEREUM_RPC_URL,
    bscRpcUrl: process.env.BSC_RPC_URL,
    mempoolBaseUrl: process.env.BITCOIN_MEMPOOL_URL,
    kadenaGraphUrl: process.env.KADENA_GRAPH_URL,
    solanaRpcUrl: process.env.SOLANA_RPC_URL,
    xrplRpcUrl: process.env.XRPL_RPC_URL
  });
}
