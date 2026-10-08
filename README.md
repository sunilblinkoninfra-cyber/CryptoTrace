# CryptoTrace

CryptoTrace is a multi-network investigation platform for Bitcoin, Ethereum, BNB Chain, XRP Ledger, and Solana. It combines off-chain transaction indexing and graph analysis with explainable risk signals, report exports, and optional case anchoring.

## Why It Matters

CryptoTrace makes investigations easier to reproduce by preserving evidence references, deterministic trace hashes, and clear provider coverage limits.

## What ships in this MVP

- `apps/web`: Next.js dashboard for search, trace review, export, and public case pages
- `apps/api`: Fastify API for traces, cases, optional ledger anchoring, rate-limited public reads, and case queries
- `apps/worker`: BullMQ worker for async trace jobs plus a worker health endpoint
- `packages/shared`: shared domain model, trace engine, heuristics, provider adapters, fixtures, and tests
- `packages/pact`: Pact contracts, payload builders, deployment helpers, and REPL tests

## Quick start

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and Redis if you want the full async mode:

   ```bash
   docker compose up -d
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Run the API and web app:

   ```bash
   npm run dev
   ```

5. Optional: run the BullMQ worker in another terminal if `DATABASE_URL` and `REDIS_URL` are configured:

   ```bash
   npm run dev:worker
   ```

## Running Pact REPL tests

Install the Pact CLI (https://github.com/kadena-io/pact/releases) then run:

```bash
cd packages/pact
pact tests/fraud-registry.repl
```

All transactions should report success. The test file covers:
- Namespace and keyset setup
- Case creation, duplicate rejection, non-reporter rejection
- Event appending and risk attestation
- fold-db list queries
- raise-dispute step 1 and GOV-gated step 2
- Risk score and risk level validation bounds

## Live chain providers

- Covalent GoldRush: primary address and transaction transfer source for Ethereum and BSC investigations
- mempool.space: Bitcoin address and transaction tracing via the public REST API, with no API key required
- Fixture fallback: deterministic demo transfers, bridge resolutions, and labeled entities that keep the full MVP usable without any live credentials

The default provider stack is route-aware: Ethereum and BNB Chain use JSON-RPC for recent USDT transfers and optional GoldRush for indexed history; Bitcoin uses mempool.space; XRP and Solana use native public RPCs. Public endpoints are best-effort and do not guarantee archival history.

## Enabling live chain data

CryptoTrace works with fixture data out of the box. To trace real wallets, configure these values in `.env`:

**Ethereum and BNB Chain** — sign up for an indexed history key at
[goldrush.dev](https://goldrush.dev), then set:
`COVALENT_API_KEY=your_key`

USDT tracing is supported as an ERC-20 token on Ethereum and a BEP-20 token on BNB Chain. It is not a separate network.

**Bitcoin** — no key required. The public mempool.space API is used
automatically when chain = bitcoin. To use a self-hosted node:
`BITCOIN_MEMPOOL_URL=http://your-node:8999`

**XRP Ledger and Solana** — public RPCs are configured by default. Set `XRPL_RPC_URL` and `SOLANA_RPC_URL` to dedicated endpoints for production; shared endpoints may rate-limit and return bounded history.

**Example addresses to try with live data:**
- Ethereum: any address from etherscan.io
- Bitcoin: any address from mempool.space
- XRP Ledger: an `r...` account address
- Solana: a base58 public key

## Case signing and anchoring

- Install the Ecko browser extension or run Chainweaver Legacy locally.
- Keep the signing wallet on the configured network.
- Create a public case from a trace, then sign the case anchor.
- The browser wallet signs the command locally and the API relays the signed transaction to the configured ledger.
- Public wallet attestations on case pages use the same wallet-sign plus relay flow.
- Pact writes enforce both the `kadenatrace.reporters` keyset and the submitted signer guard on-chain.

## Demo flow

- Open `https://your-vercel-app.vercel.app`
- Search for the Shadow Router demo compromised wallet:
  - `ethereum / 0x1111111111111111111111111111111111111111`
- Search for the Nomad-inspired demo compromised wallet:
  - `ethereum / 0x9000000000000000000000000000000000000000`
- Search for the initial compromise tx:
  - `ethereum / 0x1000000000000000000000000000000000000000000000000000000000000001`
- Review the graph, suspicious path panel, summary cards, and export actions
- Create a public case from the trace
- Optionally anchor it through the case relay endpoint

## Real-World Example

The repository includes a judge-friendly fraud simulation at `examples/real-scam-case.json`.

This case demonstrates a realistic phishing flow:

- a victim wallet is drained into a primary collector
- the collector fans funds out to four fresh splitter wallets in the same minute
- the highest-value branch hits a bridge and exits into a BSC exchange deposit wallet
- secondary branches move into a mixer, a burn address, and a DEX liquidity pool

The example includes the graph nodes, graph edges, explainable risk analysis, and the deterministic `traceHash`, so reviewers can inspect an investigation without needing live chain access.

## Pact contract architecture

The Pact deployment is split into two transactions:

1. `packages/pact/contracts/ns-setup.pact`
   - defines the `kadenatrace` namespace
   - installs `kadenatrace.admin`
   - installs `kadenatrace.reporters`
2. `packages/pact/contracts/fraud-registry.pact`
   - installs the `kadenatrace.fraud-registry` module

Tables:

- `cases`
- `case-events`
- `wallet-attestations`
- `disputes`

Capabilities:

- `GOV`
- `WRITE-CASE`
- `APPEND-EVENT`
- `ATTEST-WALLET-RISK`
- `DISPUTE`

Read functions:

- `get-case`
- `get-case-event`
- `get-wallet-attestation`
- `get-dispute`
- `list-cases-for-chain`
- `list-attestations-for-case`

Defpact flow:

- `raise-dispute` step 1 verifies reporter authority, checks the case exists, enforces the disputer guard, and inserts a dispute with status `pending`
- `raise-dispute` step 2 resumes the yielded dispute context and requires `GOV` to update the dispute status to `reviewed`

## Running REPL tests

```bash
pact packages/pact/tests/fraud-registry.repl
```

The REPL suite covers duplicate case rejection, reporter capability enforcement, list queries, risk-score validation, and the first step of the dispute defpact.

## Live Verification

Trace hashes can be checked against stored investigations using deterministic hashing.

Use:

npm run verify-trace <traceHash>

## Included deliverables

- Web dashboard
- API and worker services
- Pact contracts and REPL tests
- Two example fraud cases
- Architecture diagram and example-case notes in `docs/`
