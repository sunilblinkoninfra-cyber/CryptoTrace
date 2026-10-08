"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import { ArrowRight, Loader2, AlertCircle, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { buttonStyles } from "./ui";
import { useTraceStore } from "../lib/store";
import { isValidTraceSeed, traceableChains, type TraceableChain } from "@kadenatrace/shared/client";

const ETH_DEMO_WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const SAMPLE_TXS: Record<TraceableChain, string> = {
  bitcoin: "a".repeat(64),
  ethereum: `0x${"a".repeat(64)}`,
  bsc: `0x${"a".repeat(64)}`,
  xrpl: "a".repeat(64),
  solana: "1".repeat(64)
};

const SAMPLE_WALLETS: Record<TraceableChain, string> = {
  bitcoin: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  ethereum: ETH_DEMO_WALLET,
  bsc: ETH_DEMO_WALLET,
  xrpl: "rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv",
  solana: ""
};

export function SearchForm(): ReactElement {
  const router = useRouter();
  const [seedType, setSeedType] = useState<"address" | "tx">("address");
  const [chain, setChain] = useState<TraceableChain>("ethereum");
  const [seedValue, setSeedValue] = useState(ETH_DEMO_WALLET);
  const [error, setError] = useState<string | null>(null);
  const { fetchAndSetTrace, isLoading } = useTraceStore();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!seedValue.trim() || isLoading) return;

    setError(null);

    const normalizedInput = seedValue.trim();
    const isValidInput = isValidTraceSeed(chain, seedType, normalizedInput);

    if (!isValidInput) {
      setError(
        seedType === "address"
          ? `Enter a valid ${chain} address. You can also use the demo case to explore the workflow instantly.`
          : `Enter a valid ${chain} transaction ID. You can also use the demo case to explore the workflow instantly.`
      );
      return;
    }

    try {
      const traceId = await fetchAndSetTrace(normalizedInput, seedType, chain);
      router.push(`/trace/${traceId}`);
    } catch (err) {
      if (err instanceof Error && err.message === "Trace is already loading") return;
      setError(
        "Unable to connect to tracing engine. Possible reasons: API waking up (cold start), network issue. Please retry or use the demo case."
      );
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mx-auto w-full max-w-3xl rounded-2xl border border-white/50 bg-white/70 p-5 shadow-glow backdrop-blur-md"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5">
        <label className="grid max-w-xs gap-2 text-left">
          <span className="text-xs font-extrabold tracking-wider uppercase text-slate-500 font-display">Network</span>
          <select
            value={chain}
            onChange={(event) => {
              const nextChain = event.target.value as TraceableChain;
              setChain(nextChain);
              setSeedValue(seedType === "address" ? SAMPLE_WALLETS[nextChain] : SAMPLE_TXS[nextChain]);
              setError(null);
            }}
            className="input"
            aria-label="Select blockchain network"
            disabled={isLoading}
          >
            {traceableChains.map((network) => (
              <option key={network} value={network}>
                {{ bitcoin: "Bitcoin (BTC)", ethereum: "Ethereum (ETH / USDT)", bsc: "BNB Chain (BNB / USDT)", xrpl: "XRP Ledger (XRP)", solana: "Solana (SOL)" }[network]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex border border-slate-200/60 p-1 rounded-xl bg-slate-100/50 w-fit">
          <button
            type="button"
            className="relative cursor-pointer px-4.5 py-2 text-xs font-extrabold tracking-wider uppercase transition-colors duration-200 rounded-lg text-slate-600 focus:outline-none font-display"
            onClick={() => {
              setSeedType("address");
              setSeedValue(SAMPLE_WALLETS[chain]);
              setError(null);
            }}
          >
            {seedType === "address" && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-lg"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className={seedType === "address" ? "relative z-10 text-sky-700" : "relative z-10"}>
              Wallet Address
            </span>
          </button>
          <button
            type="button"
            className="relative cursor-pointer px-4.5 py-2 text-xs font-extrabold tracking-wider uppercase transition-colors duration-200 rounded-lg text-slate-600 focus:outline-none font-display"
            onClick={() => {
              setSeedType("tx");
              setSeedValue(SAMPLE_TXS[chain]);
              setError(null);
            }}
          >
            {seedType === "tx" && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-lg"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className={seedType === "tx" ? "relative z-10 text-sky-700" : "relative z-10"}>
              Transaction Hash
            </span>
          </button>
        </div>

        <label className="grid gap-2">
          <span className="text-xs font-extrabold tracking-wider uppercase text-slate-500 font-display">
            {seedType === "address" ? "Wallet address target" : "Transaction hash target"}
          </span>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center justify-center text-slate-400">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={seedValue}
                onChange={(e) => setSeedValue(e.target.value)}
                placeholder={seedType === "address" ? "Enter address for selected network" : "Enter transaction ID for selected network"}
                className="input pl-11 font-mono"
                spellCheck={false}
                autoComplete="off"
                aria-label={seedType === "address" ? "Wallet address" : "Transaction hash"}
                disabled={isLoading}
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={isLoading || !seedValue.trim()}
              className={buttonStyles("primary")}
              aria-label="Trace funds"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  Tracing...
                </>
              ) : (
                <>
                  Trace Funds
                  <ArrowRight className="h-4.5 w-4.5" />
                </>
              )}
            </motion.button>
          </div>
        </label>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div
                className="flex items-start gap-3.5 rounded-xl border border-rose-200 bg-rose-50/70 p-4.5 text-sm text-rose-700 shadow-sm"
                role="alert"
                aria-live="polite"
              >
                <AlertCircle className="h-5.5 w-5.5 shrink-0 text-rose-500" />
                <div className="grid gap-3 text-left">
                  <div className="grid gap-1">
                    <span className="font-display font-bold text-rose-800">
                      Forensic tracing boundary validation failed
                    </span>
                    <p className="text-slate-600 font-medium leading-relaxed">{error}</p>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      className={buttonStyles("secondary")}
                      type="button"
                      onClick={() => setError(null)}
                    >
                      Dismiss
                    </button>
                    <Link className={buttonStyles("primary")} href="/trace/demo">
                      Use Demo Case
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </motion.div>
  );
}
