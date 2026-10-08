import assert from "node:assert/strict";
import test from "node:test";

import { SolanaRpcProvider, XrplRpcProvider } from "./native-chain-providers.js";

function rpcResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function withMockFetch<T>(mock: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("Solana provider normalizes successful native transfers for address and signature seeds", async () => {
  const transaction = {
    blockTime: 1_700_000_000,
    transaction: {
      message: {
        instructions: [{
          program: "system",
          parsed: { type: "transfer", info: { source: "11111111111111111111111111111111", destination: "Vote111111111111111111111111111111111111111", lamports: 1_500_000_000 } }
        }]
      }
    },
    meta: { err: null }
  };

  await withMockFetch(async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { method: string };
    return request.method === "getSignaturesForAddress"
      ? rpcResponse({ result: [{ signature: "5".repeat(88), err: null }] })
      : rpcResponse({ result: transaction });
  }, async () => {
    const provider = new SolanaRpcProvider("https://rpc.test");
    const byAddress = await provider.listAddressActivity({ chain: "solana", address: "11111111111111111111111111111111" });
    const bySignature = await provider.getTransactionActivity({ chain: "solana", txHash: "5".repeat(88) });
    assert.equal(byAddress[0]?.asset, "SOL");
    assert.equal(byAddress[0]?.amount, 1.5);
    assert.equal(byAddress[0]?.to, "Vote111111111111111111111111111111111111111");
    assert.equal(bySignature.length, 1);
  });
});

test("Solana provider gracefully handles malformed or failed RPC responses", async () => {
  await withMockFetch(async () => rpcResponse({ error: { code: -32602, message: "invalid params" } }), async () => {
    const provider = new SolanaRpcProvider("https://rpc.test");
    assert.deepEqual(await provider.getTransactionActivity({ chain: "solana", txHash: "x" }), []);
  });
});

test("XRPL provider paginates, parses successful native payments, and ignores failed or issued payments", async () => {
  let callCount = 0;
  await withMockFetch(async (_input, init) => {
    callCount += 1;
    const request = JSON.parse(String(init?.body)) as { params: Array<{ marker?: unknown }> };
    if (!request.params[0]?.marker) {
      return rpcResponse({ result: {
        transactions: [{
          tx: { hash: "A".repeat(64), Account: "rFrom", Destination: "rTo", Amount: "1250000", TransactionType: "Payment" },
          meta: { TransactionResult: "tesSUCCESS", delivered_amount: "1250000" },
          close_time_iso: "2024-01-01T00:00:00Z"
        }],
        marker: { ledger: 1, seq: 2 }
      } });
    }
    return rpcResponse({ result: { transactions: [
      { tx: { hash: "B".repeat(64), Account: "rFrom", Destination: "rOther", Amount: "2000000", TransactionType: "Payment" }, meta: { TransactionResult: "tecNO_PERMISSION" } },
      { tx: { hash: "C".repeat(64), Account: "rFrom", Destination: "rOther", Amount: { currency: "USD", value: "10" }, TransactionType: "Payment" }, meta: { TransactionResult: "tesSUCCESS" } }
    ] } });
  }, async () => {
    const provider = new XrplRpcProvider("https://rpc.test");
    const transfers = await provider.listAddressActivity({ chain: "xrpl", address: "rFrom" });
    assert.equal(callCount, 2);
    assert.equal(transfers.length, 1);
    assert.equal(transfers[0]?.amount, 1.25);
    assert.equal(transfers[0]?.asset, "XRP");
  });
});

test("XRPL transaction lookup accepts the direct tx_json shape", async () => {
  await withMockFetch(async () => rpcResponse({ result: {
    tx_json: { hash: "D".repeat(64), Account: "rFrom", Destination: "rTo", Amount: "3000000", TransactionType: "Payment" },
    meta: { TransactionResult: "tesSUCCESS" },
    close_time_iso: "2024-01-02T00:00:00Z"
  } }), async () => {
    const provider = new XrplRpcProvider("https://rpc.test");
    const transfers = await provider.getTransactionActivity({ chain: "xrpl", txHash: "D".repeat(64) });
    assert.equal(transfers[0]?.amount, 3);
    assert.equal(transfers[0]?.to, "rTo");
  });
});
