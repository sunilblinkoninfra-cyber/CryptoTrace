import assert from "node:assert/strict";
import test from "node:test";

import { EvmRpcActivityProvider } from "./provider.js";

const ETH_USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";
const sender = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";

function rpcResponse(result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
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

test("EVM address activity recognizes USDT logs and uses Ethereum token decimals", async () => {
  const provider = new EvmRpcActivityProvider({ ethereumRpcUrl: "https://rpc.test" });
  await withMockFetch(async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { method: string; params: Array<Record<string, unknown>> };
    if (body.method === "eth_blockNumber") return rpcResponse("0x1000");
    if (body.method === "eth_getLogs") {
      const filter = body.params[0];
      assert.equal(String(filter.address).toLowerCase(), ETH_USDT.toLowerCase());
      if (Array.isArray(filter.topics) && filter.topics[1]) {
        return rpcResponse([{
          address: ETH_USDT,
          topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", `0x${sender.slice(2).padStart(64, "0")}`, `0x${recipient.slice(2).padStart(64, "0")}`],
          data: `0x${1_250_000n.toString(16)}`,
          transactionHash: `0x${"b".repeat(64)}`,
          logIndex: "0x0",
          blockNumber: "0x1000"
        }]);
      }
      return rpcResponse([]);
    }
    return rpcResponse({ timestamp: "0x65" });
  }, async () => {
    const transfers = await provider.listAddressActivity({ chain: "ethereum", address: sender });
    assert.equal(transfers.length, 1);
    assert.equal(transfers[0]?.asset, "USDT");
    assert.equal(transfers[0]?.amount, 1.25);
  });
});

test("EVM transaction seed finds BNB Chain USDT logs with the chain token's decimals", async () => {
  const provider = new EvmRpcActivityProvider({ bscRpcUrl: "https://rpc.test" });
  await withMockFetch(async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { method: string };
    if (body.method === "eth_getTransactionByHash") {
      return rpcResponse({ from: sender, to: BSC_USDT, value: "0x0" });
    }
    if (body.method === "eth_getTransactionReceipt") {
      return rpcResponse({ blockNumber: "0x2000", logs: [{
        address: BSC_USDT,
        topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", `0x${sender.slice(2).padStart(64, "0")}`, `0x${recipient.slice(2).padStart(64, "0")}`],
        data: `0x${2_500_000_000_000_000_000n.toString(16)}`,
        transactionHash: `0x${"c".repeat(64)}`,
        logIndex: "0x1",
        blockNumber: "0x2000"
      }] });
    }
    return rpcResponse({ timestamp: "0x65" });
  }, async () => {
    const transfers = await provider.getTransactionActivity({ chain: "bsc", txHash: `0x${"c".repeat(64)}` });
    assert.equal(transfers.length, 1);
    assert.equal(transfers[0]?.asset, "USDT");
    assert.equal(transfers[0]?.amount, 2.5);
  });
});
