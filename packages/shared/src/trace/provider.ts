import type {
  ActivityProvider,
  ActivityQuery,
  BridgeResolution,
  NormalizedTransfer,
  TransactionQuery
} from "../domain.js";
import { FIXTURE_BRIDGE_RESOLUTIONS, FIXTURE_TRANSFERS } from "../fixtures/sample-trace.js";
import { normalizeAddress } from "./normalizer.js";
import { MempoolSpaceProvider } from "./mempool-provider.js";
import { KadenaChainwebProvider } from "./kadena-provider.js";
import { SolanaRpcProvider, XrplRpcProvider } from "./native-chain-providers.js";

export class FixtureActivityProvider implements ActivityProvider {
  name = "fixture-provider";

  async listAddressActivity(query: ActivityQuery): Promise<NormalizedTransfer[]> {
    const address = normalizeAddress(query.chain, query.address);

    return FIXTURE_TRANSFERS.filter((transfer) => {
      if (transfer.chain !== query.chain) {
        return false;
      }

      const matchesAddress =
        normalizeAddress(transfer.chain, transfer.from) === address ||
        normalizeAddress(transfer.chain, transfer.to) === address;

      if (!matchesAddress) {
        return false;
      }

      if (query.fromTime && transfer.timestamp < query.fromTime) {
        return false;
      }

      if (query.toTime && transfer.timestamp > query.toTime) {
        return false;
      }

      return true;
    }).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  async getTransactionActivity(query: TransactionQuery): Promise<NormalizedTransfer[]> {
    return FIXTURE_TRANSFERS.filter(
      (transfer) => transfer.chain === query.chain && transfer.txHash.toLowerCase() === query.txHash.toLowerCase()
    ).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  async getBridgeResolution(bridgeTransferId: string): Promise<BridgeResolution | null> {
    return FIXTURE_BRIDGE_RESOLUTIONS.find((resolution) => resolution.bridgeTransferId === bridgeTransferId) ?? null;
  }
}

interface CovalentProviderOptions {
  apiKey?: string;
  baseUrl?: string;
}

interface EvmRpcProviderOptions {
  ethereumRpcUrl?: string;
  bscRpcUrl?: string;
}

interface DefaultProviderOptions {
  covalentApiKey?: string;
  ethereumRpcUrl?: string;
  bscRpcUrl?: string;
  mempoolBaseUrl?: string;
  kadenaGraphUrl?: string;
  solanaRpcUrl?: string;
  xrplRpcUrl?: string;
}

export class CovalentGoldRushProvider implements ActivityProvider {
  name = "covalent-goldrush";
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(options: CovalentProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.covalenthq.com";
  }

  async listAddressActivity(query: ActivityQuery): Promise<NormalizedTransfer[]> {
    if (!this.apiKey) {
      return [];
    }

    const chain = query.chain === "ethereum" ? "eth-mainnet" : query.chain === "bsc" ? "bsc-mainnet" : query.chain;
    const url = new URL(`${this.baseUrl}/v1/${chain}/address/${query.address}/transfers_v2/`);
    if (query.fromTime) {
      url.searchParams.set("from", query.fromTime);
    }
    if (query.toTime) {
      url.searchParams.set("to", query.toTime);
    }
    url.searchParams.set("key", this.apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      data?: {
        items?: Array<{
          tx_hash?: string;
          block_signed_at?: string;
          transfers?: Array<{
            from_address?: string;
            to_address?: string;
            delta?: number;
            contract_ticker_symbol?: string;
            transfer_type?: string;
          }>;
        }>;
      };
    };

    const transfers: NormalizedTransfer[] = [];
    for (const item of payload.data?.items ?? []) {
      for (const transfer of item.transfers ?? []) {
        if (!transfer.from_address || !transfer.to_address || !item.tx_hash || !item.block_signed_at) {
          continue;
        }

        transfers.push({
          id: `${query.chain}:${item.tx_hash}:${transfer.from_address}:${transfer.to_address}`,
          chain: query.chain,
          txHash: item.tx_hash,
          timestamp: item.block_signed_at,
          from: transfer.from_address,
          to: transfer.to_address,
          asset: transfer.contract_ticker_symbol ?? "UNKNOWN",
          amount: Math.abs(transfer.delta ?? 0),
          transferType:
            transfer.transfer_type === "IN" || transfer.transfer_type === "OUT" ? "token" : "contract",
          source: this.name,
          sourceUrl: url.toString()
        });
      }
    }

    return transfers.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  async getTransactionActivity(_query: TransactionQuery): Promise<NormalizedTransfer[]> {
    return [];
  }

  async getBridgeResolution(_bridgeTransferId: string): Promise<BridgeResolution | null> {
    return null;
  }
}

export class CompositeActivityProvider implements ActivityProvider {
  name = "composite";
  private readonly providers: ActivityProvider[];

  constructor(providers: ActivityProvider[]) {
    this.providers = providers;
  }

  async listAddressActivity(query: ActivityQuery): Promise<NormalizedTransfer[]> {
    for (const provider of this.providers) {
      try {
        const activity = await provider.listAddressActivity(query);
        if (activity.length > 0) {
          return activity;
        }
      } catch {
        continue;
      }
    }

    return [];
  }

  async getTransactionActivity(query: TransactionQuery): Promise<NormalizedTransfer[]> {
    for (const provider of this.providers) {
      try {
        const activity = await provider.getTransactionActivity(query);
        if (activity.length > 0) {
          return activity;
        }
      } catch {
        continue;
      }
    }

    return [];
  }

  async getBridgeResolution(bridgeTransferId: string): Promise<BridgeResolution | null> {
    for (const provider of this.providers) {
      try {
        const resolution = await provider.getBridgeResolution(bridgeTransferId);
        if (resolution) {
          return resolution;
        }
      } catch {
        continue;
      }
    }

    return null;
  }
}

class RoutedActivityProvider implements ActivityProvider {
  public readonly name = "routed-provider";
  private readonly providersByChain: Map<ActivityQuery["chain"], CompositeActivityProvider>;
  private readonly bridgeProviders: CompositeActivityProvider;

  public constructor(routes: Partial<Record<ActivityQuery["chain"], ActivityProvider[]>>, fallbacks: ActivityProvider[]) {
    this.providersByChain = new Map(
      Object.entries(routes).map(([chain, providers]) => [chain as ActivityQuery["chain"], new CompositeActivityProvider(providers ?? [])])
    );
    const bridgeProviders = new Map<string, ActivityProvider>();
    [...fallbacks, ...Object.values(routes).flat()].forEach((provider) => {
      bridgeProviders.set(provider.name, provider);
    });
    this.bridgeProviders = new CompositeActivityProvider(Array.from(bridgeProviders.values()));
  }

  public async listAddressActivity(query: ActivityQuery): Promise<NormalizedTransfer[]> {
    const provider = this.providersByChain.get(query.chain);
    return provider ? provider.listAddressActivity(query) : [];
  }

  public async getTransactionActivity(query: TransactionQuery): Promise<NormalizedTransfer[]> {
    const provider = this.providersByChain.get(query.chain);
    return provider ? provider.getTransactionActivity(query) : [];
  }

  public async getBridgeResolution(bridgeTransferId: string): Promise<BridgeResolution | null> {
    return this.bridgeProviders.getBridgeResolution(bridgeTransferId);
  }
}

export class EvmRpcActivityProvider implements ActivityProvider {
  name = "evm-rpc";
  private readonly ethereumRpcUrl: string;
  private readonly bscRpcUrl: string;

  constructor(options: EvmRpcProviderOptions) {
    this.ethereumRpcUrl =
      options.ethereumRpcUrl ??
      process.env.ETHEREUM_RPC_URL ??
      "https://ethereum-rpc.publicnode.com";
    this.bscRpcUrl =
      options.bscRpcUrl ??
      process.env.BSC_RPC_URL ??
      "https://bsc-rpc.publicnode.com";
  }

  private getRpcUrl(chain: string): string | null {
    if (chain === "ethereum") return this.ethereumRpcUrl;
    if (chain === "bsc") return this.bscRpcUrl;
    return null;
  }

  private async rpc<T>(
    url: string,
    method: string,
    params: unknown[]
  ): Promise<T | null> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params
        })
      });
      if (!response.ok) {
        console.warn(`[EvmRpcProvider] ${method} HTTP ${response.status}`);
        return null;
      }
      const json = (await response.json()) as { result?: T; error?: { message: string } };
      if (json.error) {
        console.warn(`[EvmRpcProvider] ${method} error: ${json.error.message}`);
        return null;
      }
      return json.result ?? null;
    } catch (err) {
      console.warn(
        `[EvmRpcProvider] ${method} failed:`,
        err instanceof Error ? err.message : err
      );
      return null;
    }
  }

  private async getLatestBlockNumber(url: string): Promise<number> {
    const hex = await this.rpc<string>(url, "eth_blockNumber", []);
    return hex ? parseInt(hex, 16) : 0;
  }

  private async getBlockTimestamp(
    url: string,
    blockHex: string
  ): Promise<string> {
    const block = await this.rpc<{ timestamp: string }>(
      url,
      "eth_getBlockByNumber",
      [blockHex, false]
    );
    if (!block?.timestamp) return new Date().toISOString();
    return new Date(parseInt(block.timestamp, 16) * 1000).toISOString();
  }

  async listAddressActivity(
    query: ActivityQuery
  ): Promise<NormalizedTransfer[]> {
    const rpcUrl = this.getRpcUrl(query.chain);
    if (!rpcUrl) return [];

    const address = query.address.toLowerCase();

    const TRANSFER_TOPIC =
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

    const latest = await this.getLatestBlockNumber(rpcUrl);
    if (!latest) return [];

    const fromBlock = "0x" + Math.max(0, latest - 2000).toString(16);
    const toBlock = "0x" + latest.toString(16);

    const inboundLogs = await this.rpc<EvmLog[]>(
      rpcUrl,
      "eth_getLogs",
      [{
        fromBlock,
        toBlock,
        address: getUsdtAddress(query.chain),
        topics: [
          TRANSFER_TOPIC,
          null,
          "0x" + address.slice(2).padStart(64, "0")
        ]
      }]
    ) ?? [];

    const outboundLogs = await this.rpc<EvmLog[]>(
      rpcUrl,
      "eth_getLogs",
      [{
        fromBlock,
        toBlock,
        address: getUsdtAddress(query.chain),
        topics: [
          TRANSFER_TOPIC,
          "0x" + address.slice(2).padStart(64, "0"),
          null
        ]
      }]
    ) ?? [];

    const allLogs = [...inboundLogs, ...outboundLogs];

    const seen = new Set<string>();
    const transfers: NormalizedTransfer[] = [];

    for (const log of allLogs) {
      const key = `${log.transactionHash}:${log.logIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const from =
        "0x" + (log.topics[1]?.slice(-40) ?? "0000000000000000000000000000000000000000");
      const to =
        "0x" + (log.topics[2]?.slice(-40) ?? "0000000000000000000000000000000000000000");

      if (
        from.toLowerCase() !== address &&
        to.toLowerCase() !== address
      ) {
        continue;
      }

      const token = getUsdtToken(query.chain, log.address);
      if (!token) continue;
      const rawAmount = log.data === "0x" ? "0" : log.data;
      const amount = Number(BigInt(rawAmount)) / 10 ** token.decimals;
      if (amount === 0) continue;

      const blockNumber = log.blockNumber ?? "0x0";
      const timestamp = await this.getBlockTimestamp(rpcUrl, blockNumber);

      transfers.push({
        id: `${query.chain}:${log.transactionHash}:${log.logIndex}`,
        chain: query.chain,
        txHash: log.transactionHash ?? "",
        from,
        to,
        amount,
        asset: "USDT",
        timestamp,
        transferType: "token",
        source: "evm-rpc",
        sourceUrl: rpcUrl
      });
    }

    return transfers.sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    );
  }

  async getTransactionActivity(
    query: TransactionQuery
  ): Promise<NormalizedTransfer[]> {
    const rpcUrl = this.getRpcUrl(query.chain);
    if (!rpcUrl) return [];

    const tx = await this.rpc<EvmTransaction>(
      rpcUrl,
      "eth_getTransactionByHash",
      [query.txHash]
    );
    if (!tx?.from || !tx.to) return [];

    const amount = Number(BigInt(tx.value ?? "0x0")) / 1e18;

    const receipt = await this.rpc<EvmTransactionReceipt>(
      rpcUrl,
      "eth_getTransactionReceipt",
      [query.txHash]
    );
    const blockNumber = receipt?.blockNumber ?? "0x0";
    const timestamp = await this.getBlockTimestamp(rpcUrl, blockNumber);

    const nativeTransfer: NormalizedTransfer | null = amount > 0 ? {
        id: `${query.chain}:${query.txHash}:0`,
        chain: query.chain,
        txHash: query.txHash,
        from: tx.from,
        to: tx.to,
        amount,
        asset: query.chain === "ethereum" ? "ETH" : "BNB",
        timestamp,
        transferType: "native",
        source: "evm-rpc",
        sourceUrl: rpcUrl
      } : null;
    const tokenTransfers = (receipt?.logs ?? [])
      .filter(isErc20TransferLog)
      .flatMap((log) => {
        const token = getUsdtToken(query.chain, log.address);
        const from = topicToAddress(log.topics[1]);
        const to = topicToAddress(log.topics[2]);
        if (!token || !from || !to) return [];
        const tokenAmount = Number(BigInt(log.data === "0x" ? "0" : log.data)) / 10 ** token.decimals;
        if (!tokenAmount) return [];
        return [{
          id: `${query.chain}:${query.txHash}:usdt:${log.logIndex ?? "0"}`,
          chain: query.chain,
          txHash: query.txHash,
          from,
          to,
          amount: tokenAmount,
          asset: "USDT",
          timestamp,
          transferType: "token" as const,
          source: "evm-rpc",
          sourceUrl: rpcUrl
        }];
      });

    return [...(nativeTransfer ? [nativeTransfer] : []), ...tokenTransfers];
  }

  async getBridgeResolution(
    _bridgeTransferId: string
  ): Promise<BridgeResolution | null> {
    return null;
  }
}

export function createDefaultActivityProvider(options: DefaultProviderOptions = {}): ActivityProvider {
  const fixtureProvider = new FixtureActivityProvider();
  const covalentProvider = new CovalentGoldRushProvider({ apiKey: options.covalentApiKey });
  const evmRpcProvider = new EvmRpcActivityProvider({
    ethereumRpcUrl: options.ethereumRpcUrl,
    bscRpcUrl: options.bscRpcUrl
  });
  const mempoolProvider = new MempoolSpaceProvider({
    baseUrl: options.mempoolBaseUrl ?? process.env.BITCOIN_MEMPOOL_URL
  });
  const kadenaProvider = new KadenaChainwebProvider({ graphUrl: options.kadenaGraphUrl ?? process.env.KADENA_GRAPH_URL });
  const solanaProvider = new SolanaRpcProvider(options.solanaRpcUrl);
  const xrplProvider = new XrplRpcProvider(options.xrplRpcUrl);

  return new RoutedActivityProvider(
    {
      ethereum: [evmRpcProvider, covalentProvider, fixtureProvider],
      bsc: [evmRpcProvider, covalentProvider, fixtureProvider],
      bitcoin: [mempoolProvider, fixtureProvider],
      solana: [solanaProvider, fixtureProvider],
      xrpl: [xrplProvider, fixtureProvider],
      kadena: [kadenaProvider, fixtureProvider]
    },
    [evmRpcProvider, covalentProvider, fixtureProvider, mempoolProvider, solanaProvider, xrplProvider, kadenaProvider]
  );
}

function getUsdtToken(chain: string, address: string): { decimals: number } | null {
  const normalized = address.toLowerCase();
  if (chain === "ethereum" && normalized === "0xdac17f958d2ee523a2206206994597c13d831ec7") {
    return { decimals: 6 };
  }
  if (chain === "bsc" && normalized === "0x55d398326f99059ff775485246999027b3197955") {
    return { decimals: 18 };
  }
  return null;
}

function getUsdtAddress(chain: string): string | null {
  if (chain === "ethereum") return "0xdAC17F958D2ee523a2206206994597C13D831ec7";
  if (chain === "bsc") return "0x55d398326f99059fF775485246999027B3197955";
  return null;
}

interface EvmTransaction {
  from?: string;
  to?: string | null;
  value: string;
}

interface EvmTransactionReceipt {
  blockNumber?: string;
  logs: EvmLog[];
}

interface EvmBlock {
  timestamp: string;
}

interface EvmLog {
  address: string;
  topics: string[];
  data: string;
  transactionHash?: string;
  logIndex?: string;
  blockNumber?: string;
}

interface EvmTraceEntry {
  type?: string;
  action?: {
    from?: string;
    to?: string;
    value?: string;
  };
  traceAddress?: number[];
}

const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function isErc20TransferLog(log: EvmLog) {
  return log.topics.length >= 3 && log.topics[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC;
}

function topicToAddress(topic?: string): string | null {
  if (!topic || topic.length < 40) {
    return null;
  }

  return `0x${topic.slice(-40)}`;
}

function parseHexToBigInt(value: string | undefined) {
  if (!value || value === "0x") {
    return 0n;
  }

  return BigInt(value);
}

function hexTimestampToIso(value: string) {
  const seconds = Number.parseInt(value, 16);
  return new Date(seconds * 1000).toISOString();
}

function formatUnitsToNumber(raw: bigint, decimals: number) {
  if (decimals <= 0) {
    return Number(raw);
  }

  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fractional = raw % divisor;
  const fractionalText = fractional
    .toString()
    .padStart(decimals, "0")
    .slice(0, 6)
    .replace(/0+$/, "");

  return Number(fractionalText ? `${whole}.${fractionalText}` : whole.toString());
}

function decodeTokenDecimals(value: string | undefined) {
  if (!value || value === "0x") {
    return 18;
  }

  return Number.parseInt(value, 16);
}

function decodeTokenSymbol(value: string | undefined) {
  if (!value || value === "0x") {
    return "";
  }

  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (normalized.length === 64) {
    return decodeHexAscii(normalized);
  }

  if (normalized.length >= 192) {
    const length = Number.parseInt(normalized.slice(64, 128), 16);
    if (length > 0) {
      return decodeHexAscii(normalized.slice(128, 128 + length * 2));
    }
  }

  return decodeHexAscii(normalized);
}

function decodeHexAscii(value: string) {
  const pairs = value.match(/.{1,2}/g) ?? [];
  return pairs
    .map((pair) => Number.parseInt(pair, 16))
    .filter((code) => Number.isFinite(code) && code > 0)
    .map((code) => String.fromCharCode(code))
    .join("")
    .trim();
}

function shortenContractAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
