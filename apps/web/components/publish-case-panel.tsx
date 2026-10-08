"use client";

import type { PreparedCaseAnchorPayload } from "@kadenatrace/pact";
import { useState, type ChangeEvent, type ReactElement } from "react";
import { motion } from "framer-motion";

import type { Finding, TraceRecord } from "@kadenatrace/shared/client";

import { buildPublicAuditUrl, buildTimelineSidebar, getUrgencyGauge } from "../lib/frontend-logic";
import { getApiBaseUrl } from "../lib/api";
import { useKadenaWalletSession } from "../lib/use-kadena-wallet-session";
import { Card, InspectorPanel, buttonStyles, twoColumnClassName } from "./ui";

interface TimelineSidebarEntry {
  id: string;
  title: string;
  subtitle: string;
  timestampLabel: string;
  gapLabel: string;
  terminalLabel: string | null;
  txHash: string;
}

export function PublishCasePanel({ trace }: { trace: TraceRecord }): ReactElement {
  const wallet = useKadenaWalletSession();
  const [title, setTitle] = useState("Shadow Router Investigation");
  const [summary, setSummary] = useState("A suspicious stolen-funds trace showing fan-out, bridge usage, and exchange sink behavior.");
  const [narrative, setNarrative] = useState(defaultNarrative(trace.result?.findings ?? []));
  const [status, setStatus] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const velocityMetrics = trace.result?.metrics.velocity;
  const urgencyGauge = getUrgencyGauge(velocityMetrics);
  const timelineEntries = buildTimelineSidebar(velocityMetrics) as TimelineSidebarEntry[];
  const publicAuditUrl = buildPublicAuditUrl(
    typeof window === "undefined" ? process.env.NEXT_PUBLIC_WEB_URL || "https://your-vercel-app.vercel.app" : window.location.origin,
    slug
  );

  async function createCase(): Promise<void> {
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          traceId: trace.id,
          title,
          summary,
          narrative
        })
      });
      const payload = (await response.json()) as { caseId?: string; slug?: string; error?: string };
      if (!response.ok || !payload.caseId || !payload.slug) {
        throw new Error(payload.error ?? "Unable to publish case.");
      }

      setCaseId(payload.caseId);
      setSlug(payload.slug);
      setStatus("Public case created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to publish case.");
    } finally {
      setPending(false);
    }
  }

  async function anchorCase(): Promise<void> {
    if (!caseId) {
      return;
    }
    if (!wallet.signer) {
      setStatus("Connect a compatible signing wallet before anchoring the case.");
      return;
    }
    if (wallet.networkMismatch) {
      setStatus(`Switch the wallet to ${wallet.targetNetworkId} before signing.`);
      return;
    }

    setPending(true);
    try {
      const payloadResponse = await fetch(`${getApiBaseUrl()}/api/cases/${caseId}/anchor/payload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          signer: wallet.signer
        })
      });
      const payload = (await payloadResponse.json()) as PreparedCaseAnchorPayload & { error?: string };
      if (!payloadResponse.ok || !payload.unsignedCommand) {
        throw new Error(payload.error ?? "Unable to prepare the public ledger anchor.");
      }

      const signedCommand = await wallet.signTransaction(payload.unsignedCommand);
      const submitResponse = await fetch(`${getApiBaseUrl()}/api/cases/${caseId}/anchor/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          signer: wallet.signer,
          signedCommand
        })
      });
      const submitted = (await submitResponse.json()) as { requestKey?: string; status?: string; error?: string };
      if (!submitResponse.ok || !submitted.requestKey) {
        throw new Error(submitted.error ?? "Unable to submit the public ledger anchor.");
      }

      setStatus(`Anchor ${submitted.status ?? "submitted"} with request key ${submitted.requestKey}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to anchor case.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-6">
      <div className="mb-2">
        <span className="pill">Publish Investigation</span>
        <h2 className="mt-2 text-2xl font-black text-slate-800 font-display">
          Anchor Public Forensic Report
        </h2>
        <p className="mt-2 text-sm font-semibold text-slate-500 leading-relaxed max-w-2xl">
          Publish an immutable, shareable forensic audit trail. Anchor a privacy-preserving snapshot key for independently verifiable disputes.
        </p>
      </div>

      <div className={twoColumnClassName}>
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5 bg-gradient-to-br from-white/95 to-slate-50/50 border-slate-200/60 rounded-2xl shadow-sm">
              <div className="grid gap-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
                  Signing Identity
                </div>
                <div className="trace-meta gap-2 mt-1">
                  <span className="pill font-display text-[9px] uppercase tracking-wider">
                    {wallet.currentAdapterName ?? "No Wallet Connected"}
                  </span>
                </div>
                <div className="text-sm font-extrabold text-slate-800 font-mono mt-1 truncate">
                  {wallet.signer?.accountName ?? "Verification Required"}
                </div>
                <p className="text-xs font-semibold text-slate-500 leading-relaxed mt-1">
                  {wallet.signer
                    ? "Your active account key will sign this case's root hash anchor payload."
                    : "Connect a signing wallet to anchor verification steps on the public ledger."}
                </p>
              </div>
            </Card>

            <div className={resolveUrgencyCardClassName(urgencyGauge.toneClass)}>
              <div className="grid gap-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
                  {urgencyGauge.label}
                </div>
                <div className="text-xl font-black text-slate-800 font-display mt-1">
                  {urgencyGauge.value}
                </div>
                <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                  {urgencyGauge.descriptor}
                </p>
                <p className="text-xs font-semibold text-red-600 bg-white/70 px-2.5 py-1 rounded-lg border border-red-200/40 w-fit font-mono mt-1">
                  {urgencyGauge.warning}
                </p>
              </div>
            </div>
          </div>

          <Card className="p-5 bg-gradient-to-br from-white/95 to-slate-50/50 border-slate-200/60 rounded-2xl shadow-sm">
            <div className="grid gap-2.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
                Public Verification Permastate Link
              </div>
              <span className="font-mono text-xs font-extrabold text-sky-700 bg-sky-50 border border-sky-200/60 px-3 py-2.5 rounded-xl break-all shadow-sm">
                {publicAuditUrl ?? "Permalink will be available once case is published."}
              </span>
              <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                Use this immutable URL for submitting formal complaints, exchange alerts, and sharing proof audits.
              </p>
            </div>
          </Card>

          <Card className="grid gap-5 p-6 bg-gradient-to-br from-white/95 to-slate-50/50 border-slate-200/60 rounded-2xl shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 font-display">
                Case Report Title
                <input
                  className="input bg-white text-slate-800 font-bold border-slate-200/80 focus:border-sky-500"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              <label className="flex flex-col gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 font-display">
                Executive Executive Summary
                <input
                  className="input bg-white text-slate-800 font-bold border-slate-200/80 focus:border-sky-500"
                  value={summary}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setSummary(event.target.value)}
                />
              </label>
            </div>

            <label className="grid gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 font-display">
              Public Case Narrative
              <span className="text-xs font-semibold text-slate-400 font-sans tracking-normal capitalize mt-0.5">
                Explain the laundering flow, asset splits, cross-chain hopping nodes, and final trace verdict.
              </span>
              <textarea
                className="input min-h-[220px] bg-white text-slate-800 font-medium border-slate-200/80 focus:border-sky-500"
                value={narrative}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNarrative(event.target.value)}
              />
            </label>

            {status ? (
              <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3.5 text-xs font-bold text-sky-800 font-mono shadow-sm" aria-live="polite">
                {status}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3.5 pt-2">
              <button 
                className={`${buttonStyles("primary")} cursor-pointer font-bold text-xs shadow-glow`} 
                type="button" 
                disabled={pending} 
                onClick={createCase}
              >
                {pending ? "Publishing..." : "Create Public Case"}
              </button>
              {caseId ? (
                <button 
                  className={`${buttonStyles("secondary")} cursor-pointer font-bold text-xs`} 
                  type="button" 
                  disabled={pending || !wallet.signer} 
                  onClick={anchorCase}
                >
                  Sign & Anchor Investigation
                </button>
              ) : null}
              {slug ? (
                <a 
                  className={`${buttonStyles("secondary")} cursor-pointer font-bold text-xs inline-flex items-center`} 
                  href={`/case/${slug}`}
                >
                  Open Report Portal
                </a>
              ) : null}
            </div>
          </Card>
        </div>

        {/* Right side interactive exit tracker timeline */}
        <InspectorPanel className="min-h-[520px] bg-gradient-to-br from-white/95 to-slate-50/50 border-slate-200/60 rounded-2xl p-5 shadow-sm stack">
          <div className="flex h-full flex-col gap-5">
            <div className="grid gap-2 border-b border-slate-200/60 pb-3">
              <div className="trace-meta gap-2">
                <span className="pill font-display text-[9px] uppercase tracking-wider">Laundering Velocity</span>
                <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                  {velocityMetrics?.terminalPathCount ?? 0} terminal path{velocityMetrics?.terminalPathCount === 1 ? "" : "s"}
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-800 font-display mt-1">Terminal Exit Watch</h3>
              <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                Follow chronological steps as tracked funds propagate through mixers, bridge vaults, or exit points.
              </p>
            </div>

            {timelineEntries.length > 0 ? (
              <div className="grid gap-4 overflow-y-auto pr-1">
                {timelineEntries.map((entry) => (
                  <article 
                    key={entry.id} 
                    className="rounded-2xl border border-slate-200/60 bg-white p-4.5 shadow-sm hover:border-sky-300 transition-colors"
                  >
                    <div className="grid gap-2 text-xs font-bold text-slate-600">
                      <span className="inline-flex w-fit rounded-full bg-sky-100 border border-sky-200 px-2.5 py-0.5 text-[9px] font-extrabold text-sky-700 font-display uppercase tracking-wider">
                        {entry.gapLabel}
                      </span>
                      <strong className="text-sm font-black text-slate-800 font-display">{entry.title}</strong>
                      <span className="text-slate-500 font-semibold">{entry.subtitle}</span>
                      <span className="text-slate-500 font-semibold font-mono text-[10px]">{entry.timestampLabel}</span>
                      {entry.terminalLabel ? (
                        <span className="pill bg-rose-50 border border-rose-200 text-rose-700 font-display text-[9px] uppercase tracking-wider">
                          {entry.terminalLabel}
                        </span>
                      ) : null}
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1.5 rounded-xl break-all mt-1">
                        {entry.txHash}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/20 p-6 text-center">
                <p className="max-w-[200px] text-xs font-semibold text-slate-400 leading-relaxed">
                  No terminal exits detected yet. Exit timeline will populate automatically once tracked flow reaches known endpoints.
                </p>
              </div>
            )}
          </div>
        </InspectorPanel>
      </div>
    </section>
  );
}

function defaultNarrative(findings: Finding[]): string {
  const signalList = findings.slice(0, 4).map((finding) => finding.code.replace(/-/g, " "));
  return `This investigation follows stolen funds from the seed transaction into a branching laundering flow. Key signals observed: ${signalList.join(
    ", "
  ) || "risk scoring is still pending"}.\n\nThe trace snapshot is intended for public verification and can be anchored without exposing private victim details.`;
}

function resolveUrgencyCardClassName(toneClass: string): string {
  if (toneClass.includes("critical")) {
    return "rounded-2xl border border-red-200 bg-red-50/70 p-5 shadow-sm";
  }
  if (toneClass.includes("active")) {
    return "rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm";
  }
  return "rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm";
}
