// TraceGraphPanel -- Couples graph rendering, export controls, and suspicious-path focus state.
"use client";
import type { Core } from "cytoscape";
import { useEffect, useRef, useState, type ReactElement } from "react";

import type { Finding, SuspiciousPath, TraceGraph, TraceMetrics } from "@kadenatrace/shared/client";

import { serializeEdgesCsv, serializeGraphExportJson, serializeNodesCsv } from "../lib/export";
import { GraphView } from "./graph-view";
import { SuspiciousPaths } from "./suspicious-paths";
import { DetailPanel } from "./detail-panel";
import { buttonStyles, sidebarClassName, twoColumnClassName } from "./ui";

interface TraceGraphPanelProps {
  graph: TraceGraph;
  findings: Finding[];
  metrics: TraceMetrics;
  suspiciousPaths: SuspiciousPath[];
  seedValue: string;
  title: string;
  subtitle: string;
  exportBaseName?: string;
  focusedNodeId?: string;
  onNodeSelect?: (id: string | undefined) => void;
  investigationConclusion?: string;
  activeRiskFilters?: string | null;
}

export function TraceGraphPanel(props: TraceGraphPanelProps): ReactElement {
  const [focusedPathEdgeIds, setFocusedPathEdgeIds] = useState<string[]>(
    props.suspiciousPaths[0]?.edgeIds ?? []
  );
  const cyRef = useRef<Core | null>(null);

  const downloadJson = (): void => {
    const content = serializeGraphExportJson({
      nodes: props.graph.nodes,
      edges: props.graph.edges,
      findings: props.findings,
      metrics: props.metrics
    });
    downloadBlob(`${props.exportBaseName ?? "cryptotrace-graph"}.json`, content, "application/json");
  };

  const downloadCsv = (): void => {
    downloadBlob(`${props.exportBaseName ?? "cryptotrace-graph"}-nodes.csv`, serializeNodesCsv(props.graph.nodes), "text/csv");
    downloadBlob(`${props.exportBaseName ?? "cryptotrace-graph"}-edges.csv`, serializeEdgesCsv(props.graph.edges), "text/csv");
  };

  const downloadPng = (): void => {
    const instance = cyRef.current;
    if (!instance) return;
    const png = instance.png({ output: "blob", bg: "#ffffff", scale: 2 });
    if (png instanceof Blob) {
      const url = URL.createObjectURL(png);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${props.exportBaseName ?? "cryptotrace-graph"}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    if (props.focusedNodeId) {
      const focusPath = props.suspiciousPaths
        .filter((path) => path.nodeIds.includes(props.focusedNodeId ?? ""))
        .sort((left, right) => right.riskScore - left.riskScore)[0];

      if (focusPath) {
        setFocusedPathEdgeIds([...focusPath.edgeIds]);
        return;
      }
    }

    if (props.suspiciousPaths[0]) {
      setFocusedPathEdgeIds([...props.suspiciousPaths[0].edgeIds]);
      return;
    }

    setFocusedPathEdgeIds([]);
  }, [props.focusedNodeId, props.suspiciousPaths]);

  return (
    <>
      <section className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <span className="pill">Graph Investigation</span>
            <h2 className="text-xl font-semibold text-foreground">{props.title}</h2>
            <p className="text-sm text-muted-foreground">{props.subtitle}</p>
          </div>
          {props.exportBaseName ? (
            <details className="relative group">
              <summary className={buttonStyles("secondary")}>
                Export graph
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 flex w-40 flex-col rounded-xl border border-border bg-card p-1 text-popover-foreground shadow-card">
                <button className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-secondary focus:bg-secondary" type="button" onClick={downloadJson}>Export JSON</button>
                <button className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-secondary focus:bg-secondary" type="button" onClick={downloadCsv}>Export CSV</button>
                <button className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-secondary focus:bg-secondary" type="button" onClick={downloadPng}>Export PNG</button>
              </div>
            </details>
          ) : null}
        </div>

        <div className={twoColumnClassName}>
          <div className="min-h-[520px] overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
            <GraphView
              graph={props.graph}
              findings={props.findings}
              seedValue={props.seedValue}
              suspiciousPaths={props.suspiciousPaths}
              focusedPathEdgeIds={focusedPathEdgeIds}
              focusedNodeId={props.focusedNodeId}
              onNodeSelect={props.onNodeSelect}
              investigationConclusion={props.investigationConclusion}
              activeRiskFilters={props.activeRiskFilters}
              onCyReady={(instance) => { cyRef.current = instance; }}
            />
          </div>

          <aside className={`${sidebarClassName} min-h-[520px] self-stretch`}>
            <DetailPanel graph={props.graph} findings={props.findings} />
          </aside>
        </div>
      </section>

      <SuspiciousPaths
        graph={props.graph}
        paths={props.suspiciousPaths}
        onFocusPath={(edgeIds) => setFocusedPathEdgeIds([...edgeIds])}
      />
    </>
  );
}

function downloadBlob(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
