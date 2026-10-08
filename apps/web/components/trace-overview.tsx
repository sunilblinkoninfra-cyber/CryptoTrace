"use client";

import type { TraceResult } from "@kadenatrace/shared/client";
import Link from "next/link";
import { useEffect, useMemo, useRef, type ReactElement } from "react";

import { buildInvestigationSummary, buildInvestigationTimeline } from "../lib/investigation";
import { InvestigationSummary } from "./investigation-summary";
import { InvestigationTimeline } from "./investigation-timeline";
import { RiskFlags } from "./risk-flags";
import { TraceGraphPanel } from "./trace-graph-panel";
import { VerificationStrip } from "./verification-strip";
import { ErrorStateCard, Section, buttonStyles } from "./ui";
import { useTraceStore } from "../lib/store";
import { adaptTraceData } from "../lib/adapter";

interface TraceOverviewProps {
  trace: TraceResult;
  traceId: string;
  exportBaseName?: string;
  graphTitle: string;
  graphSubtitle: string;
  showVerificationStrip?: boolean;
  isDemo?: boolean;
  autoScrollSummary?: boolean;
}

export function TraceOverview({
  trace,
  traceId,
  exportBaseName,
  graphTitle,
  graphSubtitle,
  showVerificationStrip = true,
  isDemo = false,
  autoScrollSummary = false
}: TraceOverviewProps): ReactElement {
  if (!trace?.graph || trace.graph.nodes.length === 0) {
    return (
      <Section className="pt-0">
        <ErrorStateCard
          className="w-full"
          title="No transaction graph available"
          message="Try using the demo case or verify that the wallet or transaction input is correct. We could not build a usable graph from the current trace payload."
        >
          <Link href="/trace/demo" className={buttonStyles("primary")}>
            Use Demo Case
          </Link>
        </ErrorStateCard>
      </Section>
    );
  }

  const summary = useMemo(() => buildInvestigationSummary(trace), [trace]);
  const timelineRaw = useMemo(() => buildInvestigationTimeline(trace), [trace]);
  
  const timeline = useMemo(() => {
    return timelineRaw.map((step, idx) => ({
      step: idx + 1,
      title: step.title,
      description: step.description,
      risk: (step.confidencePct && step.confidencePct > 80 ? "high" : "medium") as "high" | "medium" | "low",
      tPlus: step.offsetLabel,
      amountEth: undefined
    }));
  }, [timelineRaw]);

  const { selectedNodeId, setSelectedNodeId, activeFilters, setActiveFilters } = useTraceStore();

  useEffect(() => {
    useTraceStore.setState({ 
      traceData: adaptTraceData({ 
        id: traceId, 
        traceId: traceId, 
        status: "completed", 
        result: trace, 
        request: { chain: trace.seed.chain, seedType: "address", seedValue: trace.seed.seedValue },
        createdAt: trace.generatedAt,
        updatedAt: trace.generatedAt 
      }),
      isDemo,
      selectedNodeId: selectedNodeId || summary.topRiskWallet?.id || null,
      activeFilters: null
    });
  }, [trace, traceId, isDemo, summary.topRiskWallet?.id]);

  const summaryRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<HTMLDivElement | null>(null);
  const didAutoScrollRef = useRef(false);

  useEffect(() => {
    if (!autoScrollSummary || didAutoScrollRef.current) {
      return;
    }

    if (window.location.hash || window.scrollY > 24) {
      didAutoScrollRef.current = true;
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      didAutoScrollRef.current = true;
      return;
    }

    didAutoScrollRef.current = true;
    const animationFrame = window.requestAnimationFrame(() => {
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [autoScrollSummary]);

  const handleFocusTopRiskWallet = (nodeId: string): void => {
    if (!nodeId) {
      return;
    }

    setSelectedNodeId(nodeId);
    graphRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid gap-6 pb-10">
      {showVerificationStrip && trace.traceHash ? <VerificationStrip traceHash={trace.traceHash} /> : null}

      {isDemo ? (
        <div className="mx-auto w-full max-w-screen-xl px-6">
          <div className="flex items-start gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-700 shadow-card">
            <span className="pt-0.5 text-lg">!</span>
            <div className="grid gap-1">
              <div className="text-sm font-medium">Demo Investigation (preloaded example)</div>
              <div className="text-sm text-yellow-700/80">Live tracing is currently unavailable, so this walkthrough uses bundled example data rather than live blockchain activity.</div>
            </div>
          </div>
        </div>
      ) : null}

      <div ref={summaryRef}>
        <InvestigationSummary summary={summary} onFocusTopRiskWallet={handleFocusTopRiskWallet} />
      </div>

      <RiskFlags flags={trace.findings} active={activeFilters} onToggle={setActiveFilters} />

      <InvestigationTimeline steps={timeline} />

      <div ref={graphRef}>
        <TraceGraphPanel
          graph={trace.graph}
          findings={trace.findings}
          metrics={trace.metrics}
          suspiciousPaths={trace.suspiciousPaths}
          seedValue={trace.seed.seedValue}
          title={graphTitle}
          subtitle={graphSubtitle}
          exportBaseName={exportBaseName}
          focusedNodeId={selectedNodeId || undefined}
          onNodeSelect={(id) => setSelectedNodeId(id || null)}
          investigationConclusion={summary.conclusion}
          activeRiskFilters={activeFilters}
        />
      </div>
    </div>
  );
}
