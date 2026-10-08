import { z } from "zod";

export const supportedChains = ["ethereum", "bsc", "bitcoin", "solana", "xrpl", "kadena"] as const;
export type Chain = (typeof supportedChains)[number];
export const traceableChains = ["bitcoin", "ethereum", "bsc", "xrpl", "solana"] as const;
export type TraceableChain = (typeof traceableChains)[number];

export const nodeKinds = ["wallet", "contract", "bridge", "mixer", "exchange", "router", "multisig", "terminal"] as const;
export type NodeKind = (typeof nodeKinds)[number];

export const seedTypes = ["address", "tx"] as const;
export type SeedType = (typeof seedTypes)[number];

export const findingSeverities = ["low", "medium", "high", "critical"] as const;
export type FindingSeverity = (typeof findingSeverities)[number];

export const riskLevels = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const edgeFlags = [
  "bridge",
  "bridge-burst",
  "rapid-hop",
  "fan-out",
  "fan-in",
  "mixer",
  "sink",
  "peel-chain",
  "structuring",
  "circular-flow",
  "dormant-reactivation",
  "exchange-hopping",
  "unresolved-bridge",
  "dust",
  "airdrop",
  "exchange-cashout",
  "bridge-obfuscated",
  "path-highlight",
  "internal-transfer",
  "large-split"
] as const;
export type EdgeFlag = (typeof edgeFlags)[number];

export interface RiskSignal {
  code: string;
  title: string;
  reason: string;
  confidence: number;
  weight: number;
}

export interface EvidenceRef {
  id: string;
  label: string;
  type: "provider" | "tx" | "bridge" | "case" | "contract";
  url?: string;
  txHash?: string;
  chain?: Chain;
  note?: string;
}

export interface GraphNode {
  id: string;
  chain: Chain;
  address: string;
  kind: NodeKind;
  label: string;
  tags: string[];
  riskScore: number;
  riskConfidence: number;
  riskLevel: RiskLevel;
  reasons: string[];
  riskSignals: RiskSignal[];
  valueFromSeedPct: number;
  evidenceRefs: EvidenceRef[];
  terminal?: boolean;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  chain: Chain;
  txHash: string;
  asset: string;
  amount: number;
  amountUsd?: number;
  timestamp: string;
  flags: EdgeFlag[];
  riskScore: number;
  riskConfidence: number;
  reasons: string[];
  riskSignals: RiskSignal[];
  valueFromSeedPct: number;
  propagatedAmount: number;
  evidenceRefs: EvidenceRef[];
  synthetic?: boolean;
  bridgeTransferId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface Finding {
  code: string;
  severity: FindingSeverity;
  explanation: string;
  confidence: number;
  relatedNodeIds: string[];
  relatedEdgeIds: string[];
  evidenceRefs: EvidenceRef[];
}

export interface ExplainableRiskItem {
  wallet: string;
  label?: string;
  risk: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  reason: string;
  signals: string[];
  confidence: number;
  relatedNodeIds?: string[];
  relatedEdgeIds?: string[];
}

export interface ExplainablePathRiskItem {
  pathId: string;
  wallet: string;
  risk: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  reason: string;
  signals: string[];
  confidence: number;
  edgeIds: string[];
  nodeIds: string[];
}

export interface RiskAnalysis {
  overallRisk: "HIGH" | "MEDIUM" | "LOW";
  overallScore: number;
  summary: string;
  suspiciousWallets: ExplainableRiskItem[];
  suspiciousPaths: ExplainablePathRiskItem[];
}

export interface SuspiciousPath {
  id: string;
  startNodeId: string;
  endNodeId: string;
  nodeIds: string[];
  edgeIds: string[];
  chains: Chain[];
  riskScore: number;
  confidence: number;
  valueFromSeedPct: number;
  dominantReason: string;
}

export interface PruningSummary {
  originalNodes: number;
  originalEdges: number;
  retainedNodes: number;
  retainedEdges: number;
  prunedNodes: number;
  prunedEdges: number;
  reason: string;
}

export type TerminalEndpointType = "cex" | "bridge" | "burn" | "dex-lp" | "terminal";

export interface VelocityTimelineEntry {
  id: string;
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  fromLabel: string;
  toLabel: string;
  chain: Chain;
  txHash: string;
  asset: string;
  amount: number;
  timestamp: string;
  gapMinutesFromPrevious: number | null;
  terminalType?: TerminalEndpointType;
}

export interface TimeToExitPath {
  id: string;
  incidentEdgeId: string;
  terminalEdgeId: string;
  incidentTxHash: string;
  terminalTxHash: string;
  incidentTimestamp: string;
  terminalTimestamp: string;
  minutesToExit: number;
  hopCount: number;
  nodeIds: string[];
  edgeIds: string[];
  chainPath: Chain[];
  terminalNodeId: string;
  terminalLabel: string;
  terminalType: TerminalEndpointType;
  crossChainExit: boolean;
  spvVerificationRequired: boolean;
}

export interface VelocityMetrics {
  incidentTimestamp: string | null;
  meanTimeToExitMinutes: number | null;
  fastestTimeToExitMinutes: number | null;
  slowestTimeToExitMinutes: number | null;
  fanOutBranchAverageMinutes: number | null;
  criminalEfficiencyScore: number | null;
  urgencyLabel: string;
  urgencyRiskLevel: RiskLevel;
  terminalPathCount: number;
  crossChainExitDetected: boolean;
  spvVerificationRequired: boolean;
  requiresImmediateExchangeContact: boolean;
  recoveryPotential: string;
  terminalPaths: TimeToExitPath[];
  timeline: VelocityTimelineEntry[];
}

export interface TraceMetrics {
  totalNodes: number;
  totalEdges: number;
  chainsInvolved: Chain[];
  highRiskNodes: number;
  highRiskEdges: number;
  totalValueObserved: number;
  tracedValueToExchanges: number;
  prunedNodes: number;
  prunedEdges: number;
  suspiciousPathCount: number;
  maxDepth?: number;
  velocity: VelocityMetrics;
}

export interface TraceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface TraceResult {
  traceId: string;
  seed: TraceRequest;
  graph: TraceGraph;
  findings: Finding[];
  suspiciousPaths: SuspiciousPath[];
  metrics: TraceMetrics;
  riskAnalysis: RiskAnalysis;
  traceHash: string;
  verifiable: boolean;
  sources: EvidenceRef[];
  generatedAt: string;
  warnings: string[];
  pruning?: PruningSummary;
}

export interface TraceRecord {
  id: string;
  request: TraceRequest;
  status: "queued" | "running" | "completed" | "failed";
  result?: TraceResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseAnchor {
  requestKey: string;
  chainId: string;
  networkId: string;
  status: "pending" | "submitted" | "confirmed" | "local-simulation" | "failed";
  blockHeight?: number;
  traceHash?: string;
  metadataHash: string;
  publicUri: string;
  txPreview?: string;
  submittedAt: string;
  signerAccount?: string;
  signerPublicKey?: string;
  error?: string;
}

export interface RiskAttestation {
  attestationId?: string;
  caseId: string;
  wallet: string;
  chain: Chain;
  riskLevel: RiskLevel;
  riskScore: number;
  evidenceHash: string;
  signer: string;
  createdAt: string;
  note?: string;
  requestKey?: string;
  chainId?: string;
  networkId?: string;
  blockHeight?: number;
  status?: "submitted" | "confirmed" | "failed";
  submittedAt?: string;
  signerPublicKey?: string;
}

export interface CaseRecord {
  caseId: string;
  slug: string;
  title: string;
  summary: string;
  seed: TraceRequest;
  traceId: string;
  traceHash: string;
  traceSnapshot: TraceResult;
  publicUri: string;
  metadataHash: string;
  narrative: string;
  sourceRefs: EvidenceRef[];
  anchor?: CaseAnchor;
  attestations: RiskAttestation[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicCaseView {
  caseId: string;
  slug: string;
  title: string;
  summary: string;
  narrative: string;
  seed: TraceRequest;
  traceHash: string;
  trace: TraceResult;
  traceSnapshot?: TraceResult;
  anchor?: CaseAnchor;
  attestations: RiskAttestation[];
  sourceRefs: EvidenceRef[];
  updatedAt: string;
}

export interface TraceRequest {
  chain: Chain;
  seedType: SeedType;
  seedValue: string;
  options?: Partial<TraceOptions>;
}

export interface TraceOptions {
  maxDepth: number;
  maxNodes: number;
  lookaheadWindowDays: number;
  includeBackwardContext: boolean;
  graphPruneNodeLimit: number;
  maxSuspiciousPaths: number;
}

export interface KnownEntity {
  chain: Chain;
  address: string;
  label: string;
  kind: NodeKind;
  tags: string[];
  terminal?: boolean;
  sourceUrl?: string;
}

export interface NormalizedTransfer {
  id: string;
  chain: Chain;
  txHash: string;
  timestamp: string;
  blockNumber?: number;
  from: string;
  to: string;
  asset: string;
  amount: number;
  amountUsd?: number;
  transferType: "native" | "token" | "contract" | "synthetic-bridge";
  source: string;
  sourceUrl?: string;
  bridgeTransferId?: string;
}

export interface BridgeResolution {
  bridgeTransferId: string;
  sourceChain: Chain;
  destinationChain: Chain;
  sourceBridgeAddress: string;
  beneficiaryAddress: string;
  exitAddress?: string;
  asset: string;
  amount: number;
  timestamp: string;
  resolved: boolean;
  sourceUrl?: string;
}

export interface ActivityQuery {
  chain: Chain;
  address: string;
  fromTime?: string;
  toTime?: string;
}

export interface TransactionQuery {
  chain: Chain;
  txHash: string;
}

export interface ActivityProvider {
  name: string;
  listAddressActivity(query: ActivityQuery): Promise<NormalizedTransfer[]>;
  getTransactionActivity(query: TransactionQuery): Promise<NormalizedTransfer[]>;
  getBridgeResolution(bridgeTransferId: string): Promise<BridgeResolution | null>;
}

export interface ScoredFinding {
  findings: Finding[];
  nodeAdjustments: Map<string, { score: number; confidence: number; reasons: string[]; signals: RiskSignal[] }>;
  edgeAdjustments: Map<
    string,
    { score: number; confidence: number; reasons: string[]; flags: EdgeFlag[]; signals: RiskSignal[] }
  >;
}

export interface CaseCreateInput {
  traceId: string;
  title: string;
  summary: string;
  narrative: string;
}

export interface WalletAttestationInput {
  wallet: string;
  chain: Chain;
  riskLevel: RiskLevel;
  riskScore: number;
  evidenceHash: string;
  signer: string;
  note?: string;
}

export function isValidTraceSeed(chain: TraceableChain, seedType: SeedType, seedValue: string): boolean {
  const value = seedValue.trim();
  if (seedType === "tx") return chain === "solana"
    ? isBase58Value(value, 64)
    : /^[A-Fa-f0-9]{64}$/.test(value.replace(/^0x/i, ""));
  if (chain === "ethereum" || chain === "bsc") return /^0x[a-fA-F0-9]{40}$/.test(value);
  if (chain === "bitcoin") return /^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(value);
  if (chain === "solana") return isBase58Value(value, 32);
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(value);
}

export const traceOptionsSchema = z.object({
  maxDepth: z.number().int().min(1).max(10).default(4),
  maxNodes: z.number().int().min(10).max(1000).default(250),
  lookaheadWindowDays: z.number().int().min(1).max(30).default(7),
  includeBackwardContext: z.boolean().default(true),
  graphPruneNodeLimit: z.number().int().min(20).max(1000).default(120),
  maxSuspiciousPaths: z.number().int().min(1).max(20).default(5)
});

export const traceRequestSchema = z.object({
  chain: z.enum(traceableChains),
  seedType: z.enum(seedTypes),
  seedValue: z.string().min(3),
  options: traceOptionsSchema.partial().optional()
}).superRefine((request, context) => {
  if (!isValidTraceSeed(request.chain, request.seedType, request.seedValue)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["seedValue"],
      message: `Invalid ${request.seedType === "tx" ? "transaction identifier" : "address"} for ${request.chain}.`
    });
  }
});

function isBase58Value(value: string, expectedBytes: number): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let decoded = 0n;
  for (const character of value) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) return false;
    decoded = decoded * 58n + BigInt(digit);
  }
  let byteLength = 0;
  for (let current = decoded; current > 0n; current >>= 8n) byteLength += 1;
  const leadingZeroes = value.match(/^1*/)?.[0].length ?? 0;
  return byteLength + leadingZeroes === expectedBytes;
}

export const caseCreateSchema = z.object({
  traceId: z.string().min(3),
  title: z.string().min(3).max(140),
  summary: z.string().min(10).max(400),
  narrative: z.string().min(10).max(5000)
});

export const walletAttestationSchema = z.object({
  wallet: z.string().min(3),
  chain: z.enum(supportedChains),
  riskLevel: z.enum(riskLevels),
  riskScore: z.number().min(0).max(100),
  evidenceHash: z.string().min(6),
  signer: z.string().min(3),
  note: z.string().max(500).optional()
});
