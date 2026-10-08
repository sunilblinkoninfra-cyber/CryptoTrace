import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  buildErrorResponse,
  caseCreateSchema,
  Errors,
  supportedChains,
  walletAttestationSchema
} from "@kadenatrace/shared";

import type { CaseService } from "../services/case-service.js";
import type { ApiConfig } from "../config.js";
import { buildGetCasePublicCommand, buildListPublicCasesCommand } from "@kadenatrace/pact";

async function kadenaLocalQuery(
  command: unknown,
  cfg: ApiConfig
): Promise<unknown> {
  const url = `${cfg.kadenaNodeUrl ?? "https://api.testnet.chainweb.com"}/chainweb/0.0/${cfg.kadenaNetworkId ?? "testnet04"}/chain/${cfg.kadenaChainId ?? "1"}/pact/api/v1/local`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  if (!response.ok) {
    throw new Error(`Public ledger query failed: HTTP ${response.status}`);
  }
  const json = (await response.json()) as {
    result?: { status?: string; data?: unknown; error?: { message: string } }
  };
  if (json.result?.status === "failure") {
    throw new Error(json.result.error?.message ?? "Pact execution failed");
  }
  return json.result?.data;
}

const walletSignerSchema = z.object({
  accountName: z.string().min(3),
  publicKey: z.string().min(16),
  adapterName: z.string().min(1).optional()
});

const signedCommandSchema = z.object({
  cmd: z.string().min(3),
  hash: z.string().min(10),
  sigs: z.array(z.any())
});

const anchorPrepareSchema = z.object({
  signer: walletSignerSchema
});

const anchorSubmitSchema = z.object({
  signer: walletSignerSchema,
  signedCommand: signedCommandSchema
});

const attestationDraftSchema = z.object({
  wallet: z.string().min(3),
  chain: z.enum(supportedChains),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  riskScore: z.number().min(0).max(100),
  note: z.string().max(500).optional()
});

const attestationPrepareSchema = z.object({
  signer: walletSignerSchema,
  attestation: attestationDraftSchema
});

const attestationSubmitSchema = z.object({
  signer: walletSignerSchema,
  attestation: attestationDraftSchema,
  signedCommand: signedCommandSchema
});

const disputeCreateSchema = z.object({
  reasonHash: z.string().regex(/^[a-f0-9]{64}$/i, "reasonHash must be a SHA-256 hex string"),
  signer: walletSignerSchema
});

const disputeSubmitSchema = z.object({
  disputeId: z.string().min(3),
  signer: walletSignerSchema.optional(),
  signedCommand: signedCommandSchema
});

export async function registerCaseRoutes(app: FastifyInstance, caseService: CaseService, config: ApiConfig) {
  app.get("/api/pact/cases/:caseId", async (request, reply) => {
    const { caseId } = request.params as { caseId: string };
    try {
      const command = buildGetCasePublicCommand(
        caseId,
        config.kadenaNetworkId ?? "testnet04",
        config.kadenaChainId ?? "1"
      );
      const result = await kadenaLocalQuery(command, config);
      return reply.send({ source: "pact", data: result });
    } catch {
      const record = await caseService.findById(caseId);
      if (!record) {
        return reply.code(404).send({ error: "Case not found" });
      }
      return reply.send({ source: "offchain", data: record });
    }
  });

  app.get("/api/pact/cases", async (request, reply) => {
    const query = request.query as {
      limit?: string;
      offset?: string;
    };
    const limit = Math.min(parseInt(query.limit ?? "20", 10), 50);
    const offset = parseInt(query.offset ?? "0", 10);
    try {
      const command = buildListPublicCasesCommand(
        limit,
        offset,
        config.kadenaNetworkId ?? "testnet04",
        config.kadenaChainId ?? "1"
      );
      const result = await kadenaLocalQuery(command, config);
      return reply.send({ source: "pact", data: result });
    } catch {
      const records = await caseService.listPublicCases();
      return reply.send({ source: "offchain", data: records });
    }
  });
  app.get("/api/cases/by-chain/:chain", async (request, reply) => {
    try {
      const params = request.params as { chain: string };
      const query = request.query as { cursor?: string; limit?: string };

      const result = await caseService.listCasesByChain(params.chain, {
        cursor: query.cursor,
        limit: query.limit ? parseInt(query.limit, 10) : undefined
      });

      return reply.send(result);
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });

  app.post("/api/cases", async (request, reply) => {
    const parsed = caseCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      const error = Errors.validationError(
        "body",
        "Invalid case creation request",
        parsed.error.flatten()
      );
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }

    try {
      const record = await caseService.createCase(parsed.data);
      return reply.send({
        caseId: record.caseId,
        slug: record.slug,
        publicUri: record.publicUri,
        traceHash: record.traceHash,
        verifiable: true
      });
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });

  app.post("/api/cases/:caseId/anchor/payload", async (request, reply) => {
    const params = request.params as { caseId: string };
    const parsed = anchorPrepareSchema.safeParse(request.body);
    if (!parsed.success) {
      const error = Errors.validationError(
        "body",
        "Invalid anchor prepare request",
        parsed.error.flatten()
      );
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }

    try {
      const payload = await caseService.prepareCaseAnchor(params.caseId, parsed.data.signer);
      return reply.send(payload);
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });

  app.post("/api/cases/:caseId/anchor", async (request, reply) => {
    const params = request.params as { caseId: string };
    try {
      const record = await caseService.anchorCase(params.caseId);
      return reply.send(record.anchor);
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });

  app.post("/api/cases/:caseId/anchor/submit", async (request, reply) => {
    const params = request.params as { caseId: string };
    const parsed = anchorSubmitSchema.safeParse(request.body);
    if (!parsed.success) {
      const error = Errors.validationError(
        "body",
        "Invalid anchor submit request",
        parsed.error.flatten()
      );
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }

    try {
      const record = await caseService.submitCaseAnchor(params.caseId, parsed.data.signer, parsed.data.signedCommand);
      return reply.send(record.anchor);
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });

  app.post("/api/cases/:caseId/attestations", async (request, reply) => {
    const params = request.params as { caseId: string };
    const parsed = walletAttestationSchema.safeParse(request.body);
    if (!parsed.success) {
      const error = Errors.validationError(
        "body",
        "Invalid attestation request",
        parsed.error.flatten()
      );
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }

    try {
      const record = await caseService.addAttestation(params.caseId, parsed.data);
      return reply.send({ caseId: record.caseId, attestations: record.attestations });
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });

  app.post("/api/cases/:caseId/attestations/payload", async (request, reply) => {
    const params = request.params as { caseId: string };
    const parsed = attestationPrepareSchema.safeParse(request.body);
    if (!parsed.success) {
      const error = Errors.validationError(
        "body",
        "Invalid attestation prepare request",
        parsed.error.flatten()
      );
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }

    try {
      const payload = await caseService.prepareWalletAttestation(
        params.caseId,
        parsed.data.attestation,
        parsed.data.signer
      );
      return reply.send(payload);
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });

  app.post("/api/cases/:caseId/attestations/submit", async (request, reply) => {
    const params = request.params as { caseId: string };
    const parsed = attestationSubmitSchema.safeParse(request.body);
    if (!parsed.success) {
      const error = Errors.validationError(
        "body",
        "Invalid attestation submit request",
        parsed.error.flatten()
      );
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }

    try {
      const record = await caseService.submitWalletAttestation(
        params.caseId,
        parsed.data.attestation,
        parsed.data.signer,
        parsed.data.signedCommand
      );
      return reply.send({ caseId: record.caseId, attestations: record.attestations });
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });

  // New dispute endpoints
  app.post("/api/cases/:caseId/disputes/payload", async (request, reply) => {
    const params = request.params as { caseId: string };
    const parsed = disputeCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      const error = Errors.validationError(
        "body",
        "Invalid dispute request",
        parsed.error.flatten()
      );
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }

    try {
      const payload = await caseService.prepareDispute(params.caseId, parsed.data.reasonHash, parsed.data.signer);
      return reply.send(payload);
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });

  app.post("/api/cases/:caseId/disputes/submit", async (request, reply) => {
    const params = request.params as { caseId: string };
    const parsed = disputeSubmitSchema.safeParse(request.body);
    if (!parsed.success) {
      const error = Errors.validationError(
        "body",
        "Invalid dispute submit request",
        parsed.error.flatten()
      );
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }

    try {
      const record = await caseService.submitDispute(params.caseId, parsed.data.disputeId, parsed.data.signedCommand);
      return reply.send(record);
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });

  app.get("/api/cases/:caseId/disputes", async (request, reply) => {
    const params = request.params as { caseId: string };
    try {
      const disputes = await caseService.listDisputesForCase(params.caseId);
      return reply.send(disputes);
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });

  app.get("/api/public/cases", async (request, reply) => {
    try {
      const query = request.query as { cursor?: string; limit?: string };
      const result = await caseService.listPublicCases({
        cursor: query.cursor,
        limit: query.limit ? parseInt(query.limit, 10) : undefined
      });
      return reply.send(result);
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });

  app.get("/api/cases/:caseId/attestations", async (request, reply) => {
    try {
      const params = request.params as { caseId: string };
      const query = request.query as { cursor?: string; limit?: string };
      const result = await caseService.listAttestationsForCase(params.caseId, {
        cursor: query.cursor,
        limit: query.limit ? parseInt(query.limit, 10) : undefined
      });
      return reply.send(result);
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });

  app.get("/api/public/cases/:slug", async (request, reply) => {
    const params = request.params as { slug: string };
    const record = await caseService.getPublicCase(params.slug);
    if (!record) {
      const error = Errors.caseNotFound(params.slug);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }

    return reply.send(record);
  });
}
