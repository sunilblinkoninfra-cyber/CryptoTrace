import type {
  ActivityProvider,
  ActivityQuery,
  BridgeResolution,
  NormalizedTransfer,
  TransactionQuery
} from "../domain.js";

interface JsonRpcEnvelope<T> {
  result?: T;
  error?: { message?: string; code?: number };
}

interface SolanaTransaction {
  blockTime?: number | null;
  transaction?: {
    message?: {
      accountKeys?: Array<string | { pubkey?: string }>;
      instructions?: Array<{
        program?: string;
        parsed?: {
          type?: string;
          info?: { source?: string; destination?: string; lamports?: number | string };
        };
      }>;
    };
    signatures?: string[];
  };
  meta?: { err?: unknown };
}

interface SolanaSignatureInfo {
  signature: string;
  err?: unknown;
}

interface XrplTransaction {
  hash?: string;
  Account?: string;
  Destination?: string;
  Amount?: string | { currency?: string; value?: string };
  date?: number;
  TransactionType?: string;
}

interface XrplTransactionResult {
  tx?: XrplTransaction;
  tx_json?: XrplTransaction;
  meta?: { TransactionResult?: string; delivered_amount?: string | { currency?: string } };
  close_time_iso?: string;
  validated?: boolean;
}

export class SolanaRpcProvider implements ActivityProvider {
  public readonly name = "solana-json-rpc";
  private readonly rpcUrl: string;

  public constructor(rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com") {
    this.rpcUrl = rpcUrl.replace(/\/+$/, "");
  }

  public async listAddressActivity(query: ActivityQuery): Promise<NormalizedTransfer[]> {
    if (query.chain !== "solana") return [];
    const signatures = await this.rpc<SolanaSignatureInfo[]>("getSignaturesForAddress", [query.address, { limit: 50 }]);
    if (!signatures) return [];
    if (signatures.length === 50) {
      console.warn("[SolanaRpcProvider] Address history is capped at 50 signatures per trace hop.");
    }

    const transactions = await Promise.all(
      signatures.filter((item) => !item.err).map((item) => this.getTransaction(item.signature))
    );
    return transactions.flatMap((transaction, index) =>
      transaction ? this.toTransfers(transaction, signatures.filter((item) => !item.err)[index]?.signature ?? "") : []
    ).filter((transfer) => this.inTimeRange(transfer.timestamp, query.fromTime, query.toTime));
  }

  public async getTransactionActivity(query: TransactionQuery): Promise<NormalizedTransfer[]> {
    if (query.chain !== "solana") return [];
    const transaction = await this.getTransaction(query.txHash);
    return transaction ? this.toTransfers(transaction, query.txHash) : [];
  }

  public async getBridgeResolution(_bridgeTransferId: string): Promise<BridgeResolution | null> {
    return null;
  }

  private async getTransaction(signature: string): Promise<SolanaTransaction | null> {
    return this.rpc<SolanaTransaction>("getTransaction", [signature, {
      encoding: "jsonParsed",
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0
    }]);
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T | null> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
      });
      if (!response.ok) {
        console.warn(`[SolanaRpcProvider] ${method} returned HTTP ${response.status}.`);
        return null;
      }
      const payload = await response.json() as JsonRpcEnvelope<T>;
      if (payload.error) {
        console.warn(`[SolanaRpcProvider] ${method} failed: ${payload.error.message ?? "RPC error"}.`);
        return null;
      }
      return payload.result ?? null;
    } catch (error) {
      console.warn("[SolanaRpcProvider] RPC request failed:", error instanceof Error ? error.message : error);
      return null;
    }
  }

  private toTransfers(transaction: SolanaTransaction, signature: string): NormalizedTransfer[] {
    if (transaction.meta?.err || !transaction.blockTime || !signature) return [];
    const instructions = transaction.transaction?.message?.instructions ?? [];
    const timestamp = new Date(transaction.blockTime * 1000).toISOString();
    return instructions.flatMap((instruction, index) => {
      const info = instruction.parsed?.info;
      const lamports = Number(info?.lamports ?? 0);
      if (instruction.program !== "system" || instruction.parsed?.type !== "transfer" ||
          !info?.source || !info.destination || !Number.isFinite(lamports) || lamports <= 0) {
        return [];
      }
      return [{
        id: `solana:${signature}:${index}`,
        chain: "solana" as const,
        txHash: signature,
        timestamp,
        from: info.source,
        to: info.destination,
        amount: lamports / 1_000_000_000,
        asset: "SOL",
        transferType: "native" as const,
        source: this.name,
        sourceUrl: this.rpcUrl
      }];
    });
  }

  private inTimeRange(timestamp: string, fromTime?: string, toTime?: string): boolean {
    return (!fromTime || timestamp >= fromTime) && (!toTime || timestamp <= toTime);
  }
}

export class XrplRpcProvider implements ActivityProvider {
  public readonly name = "xrpl-json-rpc";
  private readonly rpcUrl: string;

  public constructor(rpcUrl = process.env.XRPL_RPC_URL ?? "https://s1.ripple.com:51234") {
    this.rpcUrl = rpcUrl.replace(/\/+$/, "");
  }

  public async listAddressActivity(query: ActivityQuery): Promise<NormalizedTransfer[]> {
    if (query.chain !== "xrpl") return [];
    const transfers: NormalizedTransfer[] = [];
    let marker: unknown;

    for (let page = 0; page < 3; page += 1) {
      const params: Record<string, unknown> = {
        account: query.address,
        ledger_index_min: -1,
        ledger_index_max: -1,
        binary: false,
        forward: false,
        limit: 200
      };
      if (marker !== undefined) params.marker = marker;
      const result = await this.rpc<{ transactions?: XrplTransactionResult[]; marker?: unknown }>("account_tx", params);
      if (!result) break;
      for (const item of result.transactions ?? []) {
        const tx = item.tx ?? item.tx_json;
        const transfer = tx ? this.toTransfer(tx, item) : null;
        if (transfer && this.inTimeRange(transfer.timestamp, query.fromTime, query.toTime)) transfers.push(transfer);
      }
      if (result.marker === undefined) break;
      marker = result.marker;
      if (page === 2) console.warn("[XrplRpcProvider] Account history reached the 600-transaction page cap.");
    }
    return transfers.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  public async getTransactionActivity(query: TransactionQuery): Promise<NormalizedTransfer[]> {
    if (query.chain !== "xrpl") return [];
    const result = await this.rpc<XrplTransactionResult>("tx", { transaction: query.txHash, binary: false });
    const tx = result?.tx ?? result?.tx_json;
    const transfer = tx ? this.toTransfer(tx, result!) : null;
    return transfer ? [transfer] : [];
  }

  public async getBridgeResolution(_bridgeTransferId: string): Promise<BridgeResolution | null> {
    return null;
  }

  private async rpc<T>(method: string, params: Record<string, unknown>): Promise<T | null> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, params: [params] })
      });
      if (!response.ok) {
        console.warn(`[XrplRpcProvider] ${method} returned HTTP ${response.status}.`);
        return null;
      }
      const payload = await response.json() as { result?: T; error?: string; error_message?: string };
      if (payload.error) {
        console.warn(`[XrplRpcProvider] ${method} failed: ${payload.error_message ?? payload.error}.`);
        return null;
      }
      return payload.result ?? null;
    } catch (error) {
      console.warn("[XrplRpcProvider] RPC request failed:", error instanceof Error ? error.message : error);
      return null;
    }
  }

  private toTransfer(tx: XrplTransaction, result: XrplTransactionResult): NormalizedTransfer | null {
    const amount = typeof tx.Amount === "string" ? Number(tx.Amount) / 1_000_000 : NaN;
    if (tx.TransactionType !== "Payment" || result.meta?.TransactionResult !== "tesSUCCESS" ||
        !tx.Account || !tx.Destination || !tx.hash || !Number.isFinite(amount) || amount <= 0) return null;
    const timestamp = result.close_time_iso
      ? new Date(result.close_time_iso).toISOString()
      : new Date(((tx.date ?? 0) + 946_684_800) * 1000).toISOString();
    return {
      id: `xrpl:${tx.hash}:payment`,
      chain: "xrpl",
      txHash: tx.hash,
      timestamp,
      from: tx.Account,
      to: tx.Destination,
      amount,
      asset: "XRP",
      transferType: "native",
      source: this.name,
      sourceUrl: this.rpcUrl
    };
  }

  private inTimeRange(timestamp: string, fromTime?: string, toTime?: string): boolean {
    return (!fromTime || timestamp >= fromTime) && (!toTime || timestamp <= toTime);
  }
}
