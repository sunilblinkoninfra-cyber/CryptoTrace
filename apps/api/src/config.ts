import "dotenv/config";

import { deriveChainwebBaseUrl } from "@kadenatrace/pact";

export interface ApiConfig {
  port: number;
  webBaseUrl: string;
  databaseUrl?: string;
  redisUrl?: string;
  covalentApiKey?: string;
  ethereumRpcUrl?: string;
  bscRpcUrl?: string;
  bitcoinMempoolUrl?: string;
  solanaRpcUrl?: string;
  xrplRpcUrl?: string;
  kadenaNodeUrl?: string;
  kadenaChainwebBaseUrl: string;
  kadenaNetworkId: string;
  kadenaChainId: string;
  kadenaSenderAccount: string;
  kadenaPublicKey?: string;
  kadenaSecretKey?: string;
  corsOrigin?: string;
}

export function loadConfig(): ApiConfig {
  const kadenaNodeUrl =
    process.env.KADENA_NODE_URL ??
    "https://api.testnet.chainweb.com/chainweb/0.0/testnet04/chain/1/pact";

  return {
    port: Number(process.env.PORT ?? process.env.API_PORT ?? 4000),
    webBaseUrl: process.env.WEB_BASE_URL ?? process.env.CORS_ORIGIN ?? "https://cryptotrace.vercel.app",
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    covalentApiKey: process.env.COVALENT_API_KEY,
    ethereumRpcUrl: process.env.ETHEREUM_RPC_URL,
    bscRpcUrl: process.env.BSC_RPC_URL,
    bitcoinMempoolUrl: process.env.BITCOIN_MEMPOOL_URL,
    solanaRpcUrl: process.env.SOLANA_RPC_URL,
    xrplRpcUrl: process.env.XRPL_RPC_URL,
    kadenaNodeUrl,
    kadenaChainwebBaseUrl: deriveChainwebBaseUrl(process.env.KADENA_CHAINWEB_BASE_URL ?? kadenaNodeUrl),
    kadenaNetworkId: process.env.KADENA_NETWORK_ID ?? "testnet04",
    kadenaChainId: process.env.KADENA_CHAIN_ID ?? "1",
    kadenaSenderAccount: process.env.KADENA_SENDER_ACCOUNT ?? "kadenatrace-relayer",
    kadenaPublicKey: process.env.KADENA_GAS_PAYER_PUBLIC_KEY,
    kadenaSecretKey: process.env.KADENA_GAS_PAYER_SECRET_KEY,
    corsOrigin: process.env.CORS_ORIGIN
  };
}
