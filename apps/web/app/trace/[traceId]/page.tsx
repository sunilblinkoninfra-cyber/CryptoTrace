import Link from "next/link";
import type { ReactElement } from "react";

import { CaseAnchorCard } from "../../../components/case-anchor-card";
import { PublishCasePanel } from "../../../components/publish-case-panel";
import { TraceOverview } from "../../../components/trace-overview";
import { TraceStageLoader } from "../../../components/trace-stage-loader";
import { TraceErrorState } from "../../../components/trace-error-state";
import { TraceOverviewSkeleton } from "../../../components/trace-skeletons";
import { PageShell, buttonStyles } from "../../../components/ui";
import { WalletConnectionCard } from "../../../components/wallet-connection-card";
import { getDemoTraceRecord, isDemoTraceId } from "../../../lib/demo-trace";
import { getTrace } from "../../../lib/api";

export const dynamic = "force-dynamic";

export default async function TracePage({ params }: { params: Promise<{ traceId: string }> }): Promise<ReactElement> {
  const { traceId } = await params;
  let isDemo = isDemoTraceId(traceId);
  let trace = null;

  try {
    trace = isDemo ? await getDemoTraceRecord() : await getTrace(traceId);
    if (!trace || trace.status === "failed") {
      throw new Error("Trace failed or not found");
    }
  } catch (err) {
    // API FALLBACK (MANDATORY): If API fails, fallback to demo trace
    isDemo = true;
    try {
      trace = await getDemoTraceRecord();
    } catch (demoErr) {
      trace = null;
    }
  }

  // PREVENT PARTIAL RENDER: Ensure ONLY TraceErrorState is used if everything fails
  if (!trace) {
    return <TraceErrorState traceId={traceId} />;
  }

  if (!isDemo && trace.status !== "completed") {
    trace = await waitForCompletedTrace(traceId, trace);
  }

  if (!trace) {
    return <TraceErrorState traceId={traceId} />;
  }

  if (trace.status !== "completed" || !trace.result) {
    return (
      <PageShell>
        <div className="panel stack">
          <div className="trace-meta">
            <span className="pill">Trace status</span>
            <span className="code">{trace.status}</span>
          </div>
          <h1 className="section-title">Preparing the investigation view</h1>
          <p className="muted">
            Inline mode completes immediately, while queue-backed mode waits for the worker to finish the trace.
          </p>
          <TraceStageLoader />
          <div className="actions">
            <Link href={`/trace/${traceId}`} className={buttonStyles("secondary")}>
              Refresh status
            </Link>
            <Link href="/trace/demo" className={buttonStyles("primary")}>
              Use Demo
            </Link>
          </div>
        </div>
        <TraceOverviewSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section className="panel stack">
        <div className="page-header">
          <div className="grid gap-2">
            <span className="pill">{isDemo ? "Demo Investigation" : "Investigation Trace"}</span>
            <h1 className="section-title break-words">Trace {trace.id}</h1>
            <div className="trace-meta">
              <span className="code">{trace.result.seed.seedValue}</span>
              <span className="text-sm uppercase text-muted-foreground">{trace.result.seed.seedType}</span>
            </div>
          </div>
          <Link href="/" className={buttonStyles("secondary")}>
            Start another trace
          </Link>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 text-sm shadow-card">
        <span className="text-muted-foreground">
          Graph depth:{" "}
          <strong className="text-foreground">{trace.result.metrics.maxDepth ?? 2} hops</strong>
        </span>
        <span className="text-muted-foreground">
          Nodes: <strong className="text-foreground">{trace.result.graph.nodes.length}</strong>
        </span>
        <span className="text-muted-foreground">
          Edges: <strong className="text-foreground">{trace.result.graph.edges.length}</strong>
        </span>
        {getExplorerHref(trace.result.seed.chain, trace.result.seed.seedType, trace.result.seed.seedValue) ? (
          <a
            href={getExplorerHref(trace.result.seed.chain, trace.result.seed.seedType, trace.result.seed.seedValue)!}
            target="_blank"
            rel="noreferrer"
            className={`ml-auto ${buttonStyles("secondary")}`}
          >
            Open in explorer ↗
          </a>
        ) : null}
      </div>

      <TraceOverview
        trace={trace.result}
        traceId={trace.id}
        exportBaseName={`cryptotrace-${traceId}`}
        graphTitle="Branching flow and suspicious path highlights"
        graphSubtitle="Use the filters, suspicious-path focus, and top-risk-wallet shortcut to inspect the laundering branches."
        isDemo={isDemo}
        autoScrollSummary
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <WalletConnectionCard />
        <CaseAnchorCard />
      </div>

      {isDemo ? null : <PublishCasePanel trace={trace} />}
    </PageShell>
  );
}

async function waitForCompletedTrace(
  traceId: string,
  initialTrace: Awaited<ReturnType<typeof getTrace>>
) {
  let currentTrace = initialTrace;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    if (!currentTrace || currentTrace.status === "completed" || currentTrace.status === "failed") {
      return currentTrace;
    }

    await delay(800 * attempt);
    currentTrace = await getTrace(traceId);
  }

  return currentTrace ?? initialTrace;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getExplorerHref(
  chain: string,
  seedType: string,
  value: string
): string | null {
  const segment = seedType === "tx" ? "tx" : "address";

  if (chain === "ethereum") {
    return `https://etherscan.io/${segment}/${value}`;
  }

  if (chain === "bsc") {
    return `https://bscscan.com/${segment}/${value}`;
  }

  if (chain === "bitcoin") {
    return seedType === "tx"
      ? `https://mempool.space/tx/${value}`
      : `https://mempool.space/address/${value}`;
  }

  if (chain === "solana") {
    return seedType === "tx"
      ? `https://explorer.solana.com/tx/${value}`
      : `https://explorer.solana.com/address/${value}`;
  }

  if (chain === "xrpl") {
    return seedType === "tx"
      ? `https://livenet.xrpl.org/transactions/${value}`
      : `https://livenet.xrpl.org/accounts/${value}`;
  }

  return null;
}
