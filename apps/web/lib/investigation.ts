import type {
  Chain,
  Finding,
  GraphEdge,
  GraphNode,
  SuspiciousPath,
  TraceResult
} from "@kadenatrace/shared/client";

export interface InvestigationSummaryModel {
  summaryLine: string;
  conclusion: string;
  whySuspicious: string;
  confidencePct: number;
  dataCompleteness: "High" | "Medium" | "Low";
  typeLabel: string;
  typeTone: "critical" | "mixer" | "warning" | "info";
  topRiskWallet: {
    id: string;
    label: string;
    address: string;
    riskScore: number;
  } | null;
  highestRiskScore: number;
  overallRisk: string;
  overallScore: number;
  chainFlowLabel: string;
  estimatedTimeLabel: string;
  walletCount: number;
  findingCount: number;
}

export interface InvestigationTimelineStep {
  id: string;
  code: string;
  title: string;
  description: string;
  timestamp: string;
  offsetLabel: string;
  confidencePct?: number;
}

export function buildInvestigationSummary(trace: TraceResult): InvestigationSummaryModel {
  const findingCodes = new Set(trace.findings.map((finding) => finding.code));
  const confidence = deriveConfidence(trace);
  const type = deriveInvestigationType(findingCodes);
  const topRiskWallet = getTopRiskWallet(trace.graph.nodes, trace.suspiciousPaths);
  const overallRisk = trace.riskAnalysis.overallRisk;
  const overallScore = Math.max(
    trace.riskAnalysis.overallScore,
    topRiskWallet?.riskScore ?? 0,
    Math.max(...trace.suspiciousPaths.map((path) => path.riskScore), 0)
  );
  const chainFlowLabel = formatChainFlow(trace);
  const estimatedTimeLabel = formatDuration(
    trace.metrics.velocity.meanTimeToExitMinutes ?? getTraceDurationMinutes(trace.graph.edges)
  );
  const walletCount = trace.graph.nodes.filter((node) => node.kind !== "bridge").length;

  return {
    summaryLine:
      `${walletCount} wallets in scope • ${chainFlowLabel} • ` +
      `Risk: ${overallRisk} (${Math.round(overallScore)}%) • Time: ${estimatedTimeLabel}`,
    conclusion: buildConclusion(type.label, confidence),
    whySuspicious: buildSuspicionReason(trace),
    confidencePct: Math.round(confidence * 100),
    dataCompleteness: deriveDataCompleteness(trace),
    typeLabel: type.label,
    typeTone: type.tone,
    topRiskWallet,
    highestRiskScore: Math.round(Math.max(...trace.graph.nodes.map((node) => node.riskScore), 0)),
    overallRisk,
    overallScore: Math.round(overallScore),
    chainFlowLabel,
    estimatedTimeLabel,
    walletCount,
    findingCount: trace.findings.length
  };
}

export function buildInvestigationTimeline(trace: TraceResult): InvestigationTimelineStep[] {
  const sortedEdges = [...trace.graph.edges].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const firstTimestamp = sortedEdges[0]?.timestamp;
  if (!firstTimestamp) {
    return [];
  }

  const steps: InvestigationTimelineStep[] = [];
  const originEdge = sortedEdges[0];
  if (originEdge) {
    steps.push({
      id: "origin",
      code: "origin",
      title: "Funds left the seed wallet",
      description: `${formatAmount(originEdge.amount)} ${originEdge.asset} moved from the origin wallet into the traced laundering path.`,
      timestamp: originEdge.timestamp,
      offsetLabel: buildOffsetLabel(firstTimestamp, originEdge.timestamp)
    });
  }

  const fanOutStep = buildFindingStep(
    trace,
    ["fan-out-burst", "rapid-hop-path"],
    "fan-out",
    "Funds split into multiple wallets",
    "The value was dispersed quickly across multiple downstream wallets, increasing analyst workload and obscuring ownership clusters.",
    firstTimestamp
  );
  if (fanOutStep) {
    steps.push(fanOutStep);
  }

  const bridgeEdge = sortedEdges.find(
    (edge) => Boolean(edge.bridgeTransferId) || edge.flags.includes("bridge") || edge.flags.includes("bridge-burst")
  );
  if (bridgeEdge) {
    const destinationChain = formatChainLabel(bridgeEdge.chain);
    steps.push({
      id: "bridge",
      code: "bridge",
      title: `Bridged to ${destinationChain}`,
      description: `Funds crossed chains through bridge infrastructure, fragmenting the audit trail and moving value into a new monitoring domain.`,
      timestamp: bridgeEdge.timestamp,
      offsetLabel: buildOffsetLabel(firstTimestamp, bridgeEdge.timestamp)
    });
  }

  const obfuscationStep = buildFindingStep(
    trace,
    ["mixer-touchpoint", "peel-chain", "bridge-burst", "bridge-obfuscation"],
    "obfuscation",
    "Obfuscation infrastructure was used",
    "The traced funds interacted with infrastructure commonly used to hide provenance and reduce recovery visibility.",
    firstTimestamp
  );
  if (obfuscationStep) {
    steps.push(obfuscationStep);
  }

  const sinkStep = buildFindingStep(
    trace,
    ["sink-consolidation", "exchange-hopping", "exchange-cashout"],
    "sink",
    "Funds reached likely cash-out destinations",
    "The flow converged on exchange or sink endpoints, indicating an attempt to exit the laundering chain into liquid venues.",
    firstTimestamp
  ) ?? buildSinkFallbackStep(trace, firstTimestamp);
  if (sinkStep) {
    steps.push(sinkStep);
  }

  return steps
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .filter((step, index, allSteps) => allSteps.findIndex((item) => item.id === step.id) === index);
}

export function formatChainLabel(chain: Chain | string): string {
  switch (chain) {
    case "ethereum":
      return "Ethereum";
    case "bsc":
      return "BNB Chain";
    case "bitcoin":
      return "Bitcoin";
    case "solana":
      return "Solana";
    case "xrpl":
      return "XRP Ledger";
    case "kadena":
      return "Kadena";
    default:
      return `${chain}`.toUpperCase();
  }
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) {
    return "Open";
  }

  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function truncateAddress(value: string): string {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function deriveConfidence(trace: TraceResult): number {
  const values = [
    ...trace.findings.map((finding) => finding.confidence),
    ...trace.suspiciousPaths.map((path) => path.confidence),
    ...trace.graph.nodes.map((node) => node.riskConfidence).filter((value) => value > 0)
  ]
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)
    .slice(0, 3);

  if (values.length === 0) {
    return 0.55;
  }

  const combined = 1 - values.reduce((accumulator, value) => accumulator * (1 - value), 1);
  return Number(Math.min(0.99, combined).toFixed(4));
}

function deriveInvestigationType(
  findingCodes: Set<string>
): { label: string; tone: InvestigationSummaryModel["typeTone"] } {
  if (
    findingCodes.has("bridge-burst") ||
    findingCodes.has("bridge-obfuscation") ||
    ((findingCodes.has("bridge-usage") || findingCodes.has("fan-out-burst")) &&
      (findingCodes.has("rapid-hop-path") || findingCodes.has("fan-out-burst")))
  ) {
    return {
      label: "Cross-chain laundering",
      tone: "critical"
    };
  }

  if (findingCodes.has("mixer-touchpoint")) {
    return {
      label: "Mixer obfuscation",
      tone: "mixer"
    };
  }

  if (findingCodes.has("sink-consolidation") || findingCodes.has("exchange-hopping")) {
    return {
      label: "Cash-out consolidation",
      tone: "warning"
    };
  }

  return {
    label: "Suspicious value movement",
    tone: "info"
  };
}

function buildConclusion(typeLabel: string, confidence: number): string {
  const normalizedType = typeLabel.toLowerCase();
  if (confidence >= 0.85) {
    return `This transaction pattern strongly indicates ${normalizedType} with high confidence.`;
  }
  if (confidence >= 0.7) {
    return `This transaction pattern suggests ${normalizedType} with moderate confidence.`;
  }
  return `This transaction pattern may indicate ${normalizedType}, but additional corroboration is advised.`;
}

function buildSuspicionReason(trace: TraceResult): string {
  const findingCodes = new Set(trace.findings.map((finding) => finding.code));
  if (
    (findingCodes.has("bridge-burst") || findingCodes.has("bridge-obfuscation") || findingCodes.has("bridge-usage")) &&
    (findingCodes.has("fan-out-burst") || findingCodes.has("rapid-hop-path"))
  ) {
    return "Funds were rapidly split across multiple wallets and bridged across chains, indicating laundering behavior.";
  }
  if (findingCodes.has("mixer-touchpoint")) {
    return "Funds interacted with a mixer soon after leaving the seed wallet, a common obfuscation step used to break transaction provenance.";
  }
  if (findingCodes.has("sink-consolidation") || findingCodes.has("exchange-hopping")) {
    return "Multiple risky branches converged on exchange-facing endpoints, which is consistent with an organized cash-out attempt.";
  }

  return (
    trace.findings
      .slice()
      .sort((left, right) => right.confidence - left.confidence)[0]
      ?.explanation ?? trace.riskAnalysis.summary
  );
}

function deriveDataCompleteness(trace: TraceResult): InvestigationSummaryModel["dataCompleteness"] {
  if (
    trace.graph.nodes.length >= 8 &&
    trace.graph.edges.length >= 8 &&
    trace.findings.length >= 2 &&
    trace.suspiciousPaths.length >= 1
  ) {
    return "High";
  }

  if (trace.graph.nodes.length > 0 && trace.findings.length > 0) {
    return "Medium";
  }

  return "Low";
}

function getTopRiskWallet(
  nodes: GraphNode[],
  suspiciousPaths: SuspiciousPath[]
): InvestigationSummaryModel["topRiskWallet"] {
  const highlightedNodeIds = new Set(
    suspiciousPaths
      .slice()
      .sort((left, right) => right.riskScore - left.riskScore)[0]
      ?.nodeIds ?? []
  );
  const wallet = nodes
    .filter((node) => node.kind !== "bridge")
    .slice()
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
      }
      if (highlightedNodeIds.has(left.id) !== highlightedNodeIds.has(right.id)) {
        return highlightedNodeIds.has(right.id) ? 1 : -1;
      }
      return left.address.localeCompare(right.address);
    })[0];

  return wallet
    ? {
        id: wallet.id,
        label: wallet.label,
        address: wallet.address,
        riskScore: Math.round(wallet.riskScore)
      }
    : null;
}

function formatChainFlow(trace: TraceResult): string {
  const chainOrder = Array.from(new Set(trace.graph.edges.map((edge) => edge.chain)))
    .filter(Boolean)
    .map((chain) => formatChainLabel(chain));
  if (chainOrder.length === 0) {
    return "No chain movement";
  }
  return chainOrder.join(" -> ");
}

function getTraceDurationMinutes(edges: GraphEdge[]): number | null {
  if (edges.length === 0) {
    return null;
  }

  const sortedEdges = [...edges].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const first = sortedEdges[0]?.timestamp;
  const last = sortedEdges[sortedEdges.length - 1]?.timestamp;
  if (!first || !last) {
    return null;
  }
  return Math.max(0, (Date.parse(last) - Date.parse(first)) / 1000 / 60);
}

function buildFindingStep(
  trace: TraceResult,
  codes: string[],
  id: string,
  title: string,
  fallbackDescription: string,
  firstTimestamp: string
): InvestigationTimelineStep | null {
  const finding = trace.findings
    .filter((item) => codes.includes(item.code))
    .slice()
    .sort((left, right) => right.confidence - left.confidence)[0];

  if (!finding) {
    return null;
  }

  const relatedEdges = trace.graph.edges
    .filter((edge) => finding.relatedEdgeIds.includes(edge.id))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const timestamp = relatedEdges[0]?.timestamp;
  if (!timestamp) {
    return null;
  }

  return {
    id,
    code: finding.code,
    title,
    description: finding.explanation || fallbackDescription,
    timestamp,
    offsetLabel: buildOffsetLabel(firstTimestamp, timestamp),
    confidencePct: Math.round(finding.confidence * 100)
  };
}

function buildSinkFallbackStep(trace: TraceResult, firstTimestamp: string): InvestigationTimelineStep | null {
  const exchangeNodes = new Set(
    trace.graph.nodes
      .filter((node) => node.kind === "exchange" || node.tags.includes("exchange") || node.tags.includes("sink"))
      .map((node) => node.id)
  );
  const exchangeEdge = trace.graph.edges
    .filter((edge) => exchangeNodes.has(edge.to))
    .slice()
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))[0];

  if (!exchangeEdge) {
    return null;
  }

  return {
    id: "sink",
    code: "sink",
    title: "Funds reached likely cash-out destinations",
    description: `Observed value was forwarded into an exchange-facing or sink wallet, which is commonly the final stage before liquidation.`,
    timestamp: exchangeEdge.timestamp,
    offsetLabel: buildOffsetLabel(firstTimestamp, exchangeEdge.timestamp)
  };
}

function buildOffsetLabel(firstTimestamp: string, timestamp: string): string {
  const minutes = Math.max(0, (Date.parse(timestamp) - Date.parse(firstTimestamp)) / 1000 / 60);
  if (minutes < 60) {
    return `T+${Math.round(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes > 0 ? `T+${hours}h ${remainingMinutes}m` : `T+${hours}h`;
}

function formatAmount(amount: number): string {
  return Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
}
