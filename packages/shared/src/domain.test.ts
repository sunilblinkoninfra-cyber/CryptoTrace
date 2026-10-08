import assert from "node:assert/strict";
import test from "node:test";

import { isValidTraceSeed, traceRequestSchema, traceableChains } from "./domain.js";

test("trace requests accept chain-specific address and transaction identifiers", () => {
  const validInputs = [
    { chain: "bitcoin", seedType: "address", seedValue: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" },
    { chain: "ethereum", seedType: "address", seedValue: "0x1111111111111111111111111111111111111111" },
    { chain: "bsc", seedType: "tx", seedValue: `0x${"a".repeat(64)}` },
    { chain: "xrpl", seedType: "address", seedValue: "rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv" },
    { chain: "solana", seedType: "address", seedValue: "11111111111111111111111111111111" }
  ];

  for (const input of validInputs) {
    assert.equal(traceRequestSchema.safeParse(input).success, true, `${input.chain} input should validate`);
  }
  assert.deepEqual(traceableChains, ["bitcoin", "ethereum", "bsc", "xrpl", "solana"]);
});

test("trace requests reject malformed chain-specific inputs and new legacy-chain traces", () => {
  assert.equal(isValidTraceSeed("ethereum", "address", "not-an-address"), false);
  assert.equal(isValidTraceSeed("bitcoin", "tx", "0x1234"), false);
  assert.equal(isValidTraceSeed("solana", "tx", "not-a-signature"), false);
  assert.equal(traceRequestSchema.safeParse({
    chain: "kadena",
    seedType: "address",
    seedValue: "k:legacy-case"
  }).success, false);
});
