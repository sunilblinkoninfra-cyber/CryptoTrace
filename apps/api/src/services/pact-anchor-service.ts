import { createClient, type ICommand, type ICommandResult, type IPreflightResult } from "@kadena/client";
import {
  assertSignedCommandMatches,
  buildListAttestationsForCaseCommand,
  buildListAttestationsForCasePaginatedCommand,
  buildListCasesForChainCommand,
  buildListCasesForChainPaginatedCommand,
  buildPactApiUrl,
  createAttestationId,
  prepareCaseAnchorTransaction,
  prepareWalletAttestationTransaction,
  type PreparedCaseAnchorPayload,
  type PreparedWalletAttestationPayload,
  type WalletSignerDescriptor
} from "@kadenatrace/pact";
import type { CaseAnchor, CaseRecord, Chain, RiskAttestation, RiskLevel } from "@kadenatrace/shared";
import { sha256Hex } from "@kadenatrace/shared/server";

import type { ApiConfig } from "../config.js";

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface WalletAttestationDraftInput {
  wallet: string;
  chain: Chain;
  riskLevel: RiskLevel;
  riskScore: number;
  note?: string;
}

export interface PactCaseListRow {
  "case-id": string;
  "subject-chain": string;
  "subject-kind": string;
  "subject-hash": string;
  "metadata-hash": string;
  "public-uri-hash": string;
  reporter: string;
}

export interface PactAttestationListRow {
  "attestation-id": string;
  "case-id": string;
  wallet: string;
  chain: string;
  "risk-level": string;
  "risk-score": number;
  "evidence-hash": string;
  signer: string;
}

export class PactAnchorService {
  private readonly client;
  private readonly requestTimeoutMs = 5000;

  constructor(private readonly config: ApiConfig) {
    this.client = createClient(({ chainId, networkId }) =>
      buildPactApiUrl(this.config.kadenaChainwebBaseUrl, networkId, chainId)
    );
  }

  prepareCaseAnchor(record: CaseRecord, signer: WalletSignerDescriptor): PreparedCaseAnchorPayload {
    return prepareCaseAnchorTransaction({
      caseId: record.caseId,
      traceHash: record.traceHash,
      metadataHash: record.metadataHash,
      timestamp: record.updatedAt,
      publicUri: record.publicUri,
      publicUriHash: sha256Hex(record.publicUri),
      investigator: signer.accountName,
      signer,
      chainId: this.config.kadenaChainId,
      networkId: this.config.kadenaNetworkId
    });
  }

  async submitCaseAnchor(
    record: CaseRecord,
    signer: WalletSignerDescriptor,
    signedCommand: ICommand
  ): Promise<CaseAnchor> {
    const prepared = this.prepareCaseAnchor(record, signer);
    assertSignedCommandMatches(signedCommand, prepared.unsignedCommand);

    try {
      const preflight = await withTimeout(this.client.preflight(signedCommand), "Case anchor preflight timed out.", this.requestTimeoutMs);
      ensurePactSuccess(preflight, "Case anchor preflight failed.");

      const descriptor = await withTimeout(this.client.submit(signedCommand), "Case anchor submission timed out.", this.requestTimeoutMs);
      const result = await withTimeout(this.client.listen(descriptor), "Case anchor confirmation timed out.", this.requestTimeoutMs);
      const confirmed = ensurePactSuccess(result, "Case anchor transaction failed.");

      return {
        requestKey: descriptor.requestKey,
        chainId: descriptor.chainId,
        networkId: descriptor.networkId,
        status: "confirmed",
        blockHeight: confirmed.metaData?.blockHeight,
        traceHash: record.traceHash,
        metadataHash: record.metadataHash,
        publicUri: record.publicUri,
        txPreview: prepared.txPreview,
        submittedAt: new Date().toISOString(),
        signerAccount: signer.accountName,
        signerPublicKey: signer.publicKey
      };
    } catch (error) {
      return {
        requestKey: signedCommand.hash,
        chainId: this.config.kadenaChainId,
        networkId: this.config.kadenaNetworkId,
        status: "failed",
        traceHash: record.traceHash,
        metadataHash: record.metadataHash,
        publicUri: record.publicUri,
        txPreview: prepared.txPreview,
        submittedAt: new Date().toISOString(),
        signerAccount: signer.accountName,
        signerPublicKey: signer.publicKey,
        error: error instanceof Error ? error.message : "Unable to relay case anchor."
      };
    }
  }

  async anchorCase(record: CaseRecord): Promise<CaseAnchor> {
    const previewSigner: WalletSignerDescriptor = {
      accountName: this.config.kadenaSenderAccount,
      publicKey: this.config.kadenaPublicKey ?? "preview-only"
    };
    const prepared = this.prepareCaseAnchor(record, previewSigner);

    return {
      requestKey: sha256Hex(`${record.caseId}:${record.traceHash}:${record.metadataHash}`).slice(0, 64),
      chainId: this.config.kadenaChainId,
      networkId: this.config.kadenaNetworkId,
      status: "local-simulation",
      traceHash: record.traceHash,
      metadataHash: record.metadataHash,
      publicUri: record.publicUri,
      txPreview: prepared.txPreview,
      submittedAt: new Date().toISOString(),
      signerAccount: previewSigner.accountName,
      signerPublicKey: previewSigner.publicKey
    };
  }

  prepareWalletAttestation(
    record: CaseRecord,
    input: WalletAttestationDraftInput,
    signer: WalletSignerDescriptor
  ): PreparedWalletAttestationPayload {
    const evidenceHash = this.createAttestationEvidenceHash(record, input);
    const attestationId = createAttestationId({
      caseId: record.caseId,
      wallet: input.wallet,
      chain: input.chain,
      riskLevel: input.riskLevel,
      riskScore: input.riskScore,
      evidenceHash,
      signerAccount: signer.accountName
    });
    const timestamp = record.updatedAt;

    return prepareWalletAttestationTransaction({
      attestationId,
      caseId: record.caseId,
      wallet: input.wallet,
      chain: input.chain,
      riskLevel: input.riskLevel,
      riskScore: input.riskScore,
      evidenceHash,
      timestamp,
      signer,
      chainId: this.config.kadenaChainId,
      networkId: this.config.kadenaNetworkId
    });
  }

  async submitWalletAttestation(
    record: CaseRecord,
    input: WalletAttestationDraftInput,
    signer: WalletSignerDescriptor,
    signedCommand: ICommand
  ): Promise<RiskAttestation> {
    const prepared = this.prepareWalletAttestation(record, input, signer);
    assertSignedCommandMatches(signedCommand, prepared.unsignedCommand);

    const baseAttestation: RiskAttestation = {
      attestationId: prepared.attestationId,
      caseId: record.caseId,
      wallet: input.wallet,
      chain: input.chain,
      riskLevel: input.riskLevel,
      riskScore: input.riskScore,
      evidenceHash: prepared.evidenceHash,
      signer: signer.accountName,
      signerPublicKey: signer.publicKey,
      note: input.note,
      createdAt: prepared.timestamp,
      submittedAt: prepared.timestamp
    };

    try {
      const preflight = await withTimeout(this.client.preflight(signedCommand), "Wallet attestation preflight timed out.", this.requestTimeoutMs);
      ensurePactSuccess(preflight, "Wallet attestation preflight failed.");

      const descriptor = await withTimeout(this.client.submit(signedCommand), "Wallet attestation submission timed out.", this.requestTimeoutMs);
      const result = await withTimeout(this.client.listen(descriptor), "Wallet attestation confirmation timed out.", this.requestTimeoutMs);
      const confirmed = ensurePactSuccess(result, "Wallet attestation transaction failed.");

      return {
        ...baseAttestation,
        requestKey: descriptor.requestKey,
        chainId: descriptor.chainId,
        networkId: descriptor.networkId,
        blockHeight: confirmed.metaData?.blockHeight,
        status: "confirmed"
      };
    } catch (error) {
      return {
        ...baseAttestation,
        requestKey: signedCommand.hash,
        chainId: this.config.kadenaChainId,
        networkId: this.config.kadenaNetworkId,
        status: "failed",
        blockHeight: undefined,
        note: input.note ? `${input.note}\n\nRelay error: ${stringifyError(error)}` : `Relay error: ${stringifyError(error)}`
      };
    }
  }

  async listCasesForChain(chain: string): Promise<PactCaseListRow[]> {
    const command = buildListCasesForChainCommand(chain, this.config.kadenaNetworkId, this.config.kadenaChainId);
    const result = await withTimeout(this.client.dirtyRead(command), "Timed out while reading cases for chain.", this.requestTimeoutMs);
    const successful = ensurePactSuccess(result, "Unable to read cases for chain.") as ICommandResult & {
      result: { data?: unknown };
    };
    return Array.isArray(successful.result.data) ? (successful.result.data as PactCaseListRow[]) : [];
  }

  async listAttestationsForCase(caseId: string): Promise<PactAttestationListRow[]> {
    const command = buildListAttestationsForCaseCommand(caseId, this.config.kadenaNetworkId, this.config.kadenaChainId);
    const result = await withTimeout(this.client.dirtyRead(command), "Timed out while reading attestations for case.", this.requestTimeoutMs);
    const successful = ensurePactSuccess(result, "Unable to read attestations for case.") as ICommandResult & {
      result: { data?: unknown };
    };
    return Array.isArray(successful.result.data) ? (successful.result.data as PactAttestationListRow[]) : [];
  }

  async listCasesForChainPaginated(
    chain: string,
    params: PaginationParams
  ): Promise<PaginatedResult<PactCaseListRow>> {
    const offset = params.cursor ? parseInt(params.cursor, 10) : 0;
    const limit = Math.min(params.limit ?? 20, 100);

    const command = buildListCasesForChainPaginatedCommand(
      chain,
      offset,
      limit,
      this.config.kadenaNetworkId,
      this.config.kadenaChainId
    );

    const result = await withTimeout(this.client.dirtyRead(command), "Timed out while reading paginated cases.", this.requestTimeoutMs);
    const successful = ensurePactSuccess(result, "Unable to read paginated cases.") as ICommandResult & {
      result: { data?: unknown };
    };

    const items = Array.isArray(successful.result.data) ? (successful.result.data as PactCaseListRow[]) : [];
    const hasMore = items.length === limit;

    return {
      items,
      nextCursor: hasMore ? String(offset + limit) : undefined,
      hasMore
    };
  }

  async listAttestationsForCasePaginated(
    caseId: string,
    params: PaginationParams
  ): Promise<PaginatedResult<PactAttestationListRow>> {
    const offset = params.cursor ? parseInt(params.cursor, 10) : 0;
    const limit = Math.min(params.limit ?? 20, 100);

    const command = buildListAttestationsForCasePaginatedCommand(
      caseId,
      offset,
      limit,
      this.config.kadenaNetworkId,
      this.config.kadenaChainId
    );

    const result = await withTimeout(
      this.client.dirtyRead(command),
      "Timed out while reading paginated attestations.",
      this.requestTimeoutMs
    );
    const successful = ensurePactSuccess(result, "Unable to read paginated attestations.") as ICommandResult & {
      result: { data?: unknown };
    };

    const items = Array.isArray(successful.result.data) ? (successful.result.data as PactAttestationListRow[]) : [];
    const hasMore = items.length === limit;

    return {
      items,
      nextCursor: hasMore ? String(offset + limit) : undefined,
      hasMore
    };
  }

  private createAttestationEvidenceHash(record: CaseRecord, input: WalletAttestationDraftInput): string {
    return sha256Hex(
      JSON.stringify({
        caseId: record.caseId,
        metadataHash: record.metadataHash,
        wallet: input.wallet,
        chain: input.chain,
        riskLevel: input.riskLevel,
        riskScore: input.riskScore,
        note: input.note ?? ""
      })
    );
  }

  private createCaseSubjectHash(record: CaseRecord): string {
    return sha256Hex(
      JSON.stringify({
        chain: record.seed.chain,
        seedType: record.seed.seedType,
        seedValue: record.seed.seedValue
      })
    );
  }
}

function ensurePactSuccess(result: ICommandResult | IPreflightResult, fallbackMessage: string): ICommandResult {
  const commandResult = "preflightResult" in result ? result.preflightResult : result;
  if (commandResult.result.status === "failure") {
    throw new Error(commandResult.result.error.message || fallbackMessage);
  }

  return commandResult;
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown anchor relay error.";
}

async function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}
