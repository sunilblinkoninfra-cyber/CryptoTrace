"use client";

import Link from "next/link";
import { useEffect, useState, type ReactElement } from "react";
import { Shield, Zap, Search, Activity, Network, AlertTriangle, FileCheck } from "lucide-react";
import { motion } from "framer-motion";

import { SearchForm } from "../components/search-form";
import { buttonStyles } from "../components/ui";

export default function HomePage(): ReactElement {
  return (
    <main className="relative flex-1 overflow-hidden">
      {/* Dynamic ambient backgrounds */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[460px] w-[900px] -translate-x-1/2 rounded-full bg-sky-200/40 blur-[130px]" />
      <div className="pointer-events-none absolute -left-32 top-36 h-[420px] w-[420px] rounded-full bg-blue-100/40 blur-[110px]" />
      <div className="pointer-events-none absolute -right-28 bottom-24 h-[420px] w-[420px] rounded-full bg-indigo-100/30 blur-[110px]" />

      <div className="relative z-10 mx-auto flex max-w-screen-xl flex-col gap-6 px-6 py-16 lg:py-24">
        {/* Hero Section */}
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="mb-6 flex justify-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-700 backdrop-blur-md shadow-sm font-display">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500"></span>
              </span>
              Bitcoin • Ethereum • BNB • XRP • Solana
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-6 font-display text-5xl font-black tracking-tight text-slate-800 sm:text-7xl leading-tight"
          >
            Trace suspicious<br />
            <span className="bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">
              blockchain funds
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mx-auto mb-10 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600 font-medium"
          >
            CryptoTrace follows wallet activity across supported networks and explains suspicious patterns such as rapid hops, fan-out bursts, and cross-chain movement.
          </motion.p>

          <div className="mb-8">
            <SearchForm />
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-6"
          >
            <Link href="/trace/demo" className={buttonStyles("secondary")}>
              View Demo Investigation
            </Link>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 font-display">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-glow"></span>
              Multi-network tracing
            </div>
          </motion.div>
        </div>

        {/* Bento Grid Features Showcase */}
        <div className="mt-28">
          <div className="mb-10 text-center">
            <h2 className="font-display text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">
              Forensic Powerhouse Tools
            </h2>
            <p className="mt-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              Verifiable cyber investigation suite at your fingertips
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Cell 1: Network flow visualizer */}
            <BentoCard
              icon={<Network className="h-6 w-6 text-sky-600" />}
              title="2-Hop Flow Networks"
              description="Traces fund flows up to 2 tiers deep to isolate immediate withdrawals, obfuscations, and downstream hops."
            >
              <InteractiveGraphPreview />
            </BentoCard>

            {/* Cell 2: Live risk detector */}
            <BentoCard
              icon={<AlertTriangle className="h-6 w-6 text-amber-600" />}
              title="AI Forensic Verdicts"
              description="Monitors and scores transaction chains for rapid hops, splitting bursts, and critical risk signals automatically."
            >
              <InteractiveRiskTicker />
            </BentoCard>

            {/* Cell 3: Verifiable reports */}
            <BentoCard
              icon={<Shield className="h-6 w-6 text-emerald-600" />}
              title="Verifiable Investigation Reports"
              description="Export clear investigation summaries with trace evidence, findings, and reproducible trace hashes."
            >
              <InteractiveLedgerAnchor />
            </BentoCard>
          </div>
        </div>
      </div>
    </main>
  );
}

/* Reusable Bento Card Wrapper */
function BentoCard({
  icon,
  title,
  description,
  children
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}): ReactElement {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col justify-between overflow-hidden rounded-2xl border border-white/50 bg-white/70 p-6 shadow-glow backdrop-blur-md"
    >
      <div>
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
          {icon}
        </div>
        <h3 className="mb-2 font-display text-base font-extrabold text-slate-800 tracking-tight">
          {title}
        </h3>
        <p className="mb-6 text-xs font-semibold leading-relaxed text-slate-500">
          {description}
        </p>
      </div>

      <div className="relative mt-auto overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50 p-4 min-h-[140px] flex items-center justify-center">
        {children}
      </div>
    </motion.div>
  );
}

/* Interactive Bento Component 1: Graph Flow */
function InteractiveGraphPreview(): ReactElement {
  return (
    <div className="relative w-full h-[100px] flex items-center justify-between px-8">
      {/* Left Node */}
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        className="z-10 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-sky-500 text-white shadow-glow border-2 border-white"
      >
        <Search className="h-3 w-3" />
      </motion.div>

      {/* Connection Lines with moving particles */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <line x1="20%" y1="50%" x2="80%" y2="25%" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="4 4" />
        <line x1="20%" y1="50%" x2="80%" y2="75%" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="4 4" />

        {/* Animated laser particles */}
        <motion.circle
          cx="0"
          cy="0"
          r="3"
          fill="#0EA5E9"
          animate={{
            cx: ["25%", "75%"],
            cy: ["48%", "27%"]
          }}
          transition={{
            repeat: Infinity,
            duration: 1.8,
            ease: "linear"
          }}
        />
        <motion.circle
          cx="0"
          cy="0"
          r="3"
          fill="#3B82F6"
          animate={{
            cx: ["25%", "75%"],
            cy: ["52%", "73%"]
          }}
          transition={{
            repeat: Infinity,
            duration: 2.2,
            ease: "linear",
            delay: 0.5
          }}
        />
      </svg>

      {/* Right Nodes */}
      <div className="flex flex-col gap-6.5 z-10">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-700 shadow-sm border border-slate-200"
        >
          <span className="text-[9px] font-bold">H1</span>
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut", delay: 0.3 }}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-700 shadow-sm border border-slate-200"
        >
          <span className="text-[9px] font-bold">H2</span>
        </motion.div>
      </div>
    </div>
  );
}

/* Interactive Bento Component 2: Risk Log Ticker */
function InteractiveRiskTicker(): ReactElement {
  const [logs, setLogs] = useState<Array<{ id: number; text: string; active: boolean }>>([
    { id: 1, text: "Fan-out split detected: 14 receivers", active: true },
    { id: 2, text: "Large volume movement: >150 ETH", active: false },
    { id: 3, text: "Rapid hops within 15 seconds", active: false }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs((prev) => {
        const next = [...prev];
        const activeIdx = next.findIndex((l) => l.active);
        if (activeIdx !== -1 && next[activeIdx]) {
          next[activeIdx].active = false;
        }
        const nextActiveIdx = activeIdx === -1 ? 0 : (activeIdx + 1) % next.length;
        if (next[nextActiveIdx]) {
          next[nextActiveIdx].active = true;
        }
        return next;
      });
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-2 w-full px-2 text-left">
      {logs.map((log) => (
        <motion.div
          key={log.id}
          animate={{
            opacity: log.active ? 1 : 0.45,
            x: log.active ? 0 : -3,
            scale: log.active ? 1 : 0.97
          }}
          transition={{ duration: 0.3 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold font-mono transition-colors ${
            log.active
              ? "bg-amber-50 border-amber-200 text-amber-800 shadow-sm"
              : "bg-white/40 border-slate-200/50 text-slate-500"
          }`}
        >
          <Zap className={`h-3 w-3 shrink-0 ${log.active ? "text-amber-500" : "text-slate-400"}`} />
          <span className="truncate">{log.text}</span>
        </motion.div>
      ))}
    </div>
  );
}

/* Interactive Bento Component 3: Ledger Verification Anchor */
function InteractiveLedgerAnchor(): ReactElement {
  const [status, setStatus] = useState<"auditing" | "secured">("auditing");

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus((prev) => (prev === "auditing" ? "secured" : "auditing"));
    }, 3800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center gap-2.5 w-full text-center">
      <motion.div
        animate={{
          rotate: status === "auditing" ? 360 : 0,
          scale: status === "auditing" ? [1, 1.05, 1] : 1
        }}
        transition={{
          rotate: { repeat: status === "auditing" ? Infinity : 0, duration: 2, ease: "linear" },
          scale: { duration: 0.4 }
        }}
        className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm ${
          status === "auditing"
            ? "bg-sky-50 border-sky-200 text-sky-600"
            : "bg-emerald-50 border-emerald-200 text-emerald-600"
        }`}
      >
        <FileCheck className="h-4.5 w-4.5" />
      </motion.div>

      <div className="grid gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider font-display text-slate-500">
          Pact Smart Contract Status
        </span>
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-xs font-black tracking-tight ${
            status === "auditing" ? "text-sky-700" : "text-emerald-700"
          }`}
        >
          {status === "auditing" ? "Verifying Forensic Signatures..." : "Attested & Locked on Chain"}
        </motion.div>
      </div>
    </div>
  );
}
