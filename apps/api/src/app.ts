import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { parse as parseYaml } from "yaml";

import { DEMO_TRACE_REQUEST, NOMAD_TRACE_REQUEST } from "@kadenatrace/shared";

import type { ApiConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { MemoryCaseRepository, MemoryTraceRepository } from "./repositories/memory-repository.js";
import { PostgresCaseRepository, PostgresTraceRepository, createPostgresPool } from "./repositories/postgres.js";
import { registerCaseRoutes } from "./routes/cases.js";
import { registerTraceRoutes } from "./routes/traces.js";
import { CaseService } from "./services/case-service.js";
import { PactAnchorService } from "./services/pact-anchor-service.js";
import { BullMqTraceQueue } from "./services/trace-queue.js";
import { TraceService } from "./services/trace-service.js";

export async function buildApp(config: ApiConfig = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    genReqId: () => randomUUID()
  });

  const allowedOrigin = process.env.WEB_URL || "https://cryptotrace.vercel.app";
  console.log("CORS allowed origin:", allowedOrigin);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow server-to-server / curl

      if (
        origin === allowedOrigin ||
        origin.includes("vercel.app") || // allow preview deployments
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1")
      ) {
        return cb(null, true);
      }

      cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"]
  });

  await app.register(import("@fastify/rate-limit"), {
    max: 60,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Retry after ${context.after}.`
    })
  });

  // Add request ID header to all responses
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  // Error handler
  app.setErrorHandler(async (error, request, reply) => {
    const err = error as any;
    request.log.error(err);
    reply.code(err.statusCode ?? 500).send({
      code: err.code ?? "INTERNAL_ERROR",
      message: err.message ?? "Unknown error",
      timestamp: new Date().toISOString(),
      requestId: request.id
    });
  });

  const pool = config.databaseUrl ? await createPostgresPool(config.databaseUrl) : null;
  const traceRepository = pool ? new PostgresTraceRepository(pool) : new MemoryTraceRepository();
  const caseRepository = pool ? new PostgresCaseRepository(pool) : new MemoryCaseRepository();
  const queue = config.redisUrl ? new BullMqTraceQueue(config.redisUrl) : undefined;

  const traceService = new TraceService(
    traceRepository,
    config.covalentApiKey,
    config.ethereumRpcUrl,
    config.bscRpcUrl,
    config.bitcoinMempoolUrl,
    queue,
    config.solanaRpcUrl,
    config.xrplRpcUrl
  );
  const pactAnchorService = new PactAnchorService(config);
  const caseService = new CaseService(caseRepository, traceService, pactAnchorService, config.webBaseUrl);

  // Root endpoint with links
  app.get("/", async () => ({
    name: "CryptoTrace API",
    version: "1.0.0",
    status: "ok",
    documentation: {
      openapi: "/api/docs/openapi.json",
      swaggerUI: "/api/docs"
    },
    health: "/api/health"
  }));

  // Health check endpoint
  app.get("/health", async () => ({
    status: "ok",
    service: "cryptotrace-api",
    env: process.env.NODE_ENV || "production"
  }));

  app.get("/api/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    services: {
      queue: queue ? "bullmq" : "inline",
      storage: pool ? "postgres" : "memory"
    }
  }));

  // Detailed health check
  app.get("/api/health/detailed", async () => {
    const health = {
      status: "ok" as const,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        queue: {
          mode: queue ? "bullmq" : "inline",
          healthy: true
        },
        storage: {
          mode: pool ? "postgres" : "memory",
          healthy: true
        },
        kadena: {
          networkId: config.kadenaNetworkId,
          chainId: config.kadenaChainId,
          healthy: true
        }
      }
    };
    return health;
  });

  // OpenAPI documentation endpoints
  app.get("/api/docs/openapi.json", async () => {
    try {
      const yamlPath = resolve(process.cwd(), "openapi.yml");
      const yamlContent = readFileSync(yamlPath, "utf-8");
      return parseYaml(yamlContent);
    } catch (error) {
      return { error: "OpenAPI spec not available" };
    }
  });

  app.get("/api/docs", async (request, reply) => {
    reply.header("Content-Type", "text/html");
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>CryptoTrace API Documentation</title>
          <meta charset="utf-8" />
          <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
        </head>
        <body>
          <div id="swagger-ui"></div>
          <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
          <script>
            SwaggerUIBundle({
              url: '/api/docs/openapi.json',
              dom_id: '#swagger-ui',
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.presets.standalone
              ]
            });
          </script>
        </body>
      </html>
    `;
  });

  await registerTraceRoutes(app, traceService);
  await registerCaseRoutes(app, caseService, config);
  await seedDemoCases(caseService, traceService);

  app.addHook("onClose", async () => {
    if (queue) {
      await queue.close();
    }

    if (pool) {
      await pool.end();
    }
  });

  return app;
}

async function seedDemoCases(caseService: CaseService, traceService: TraceService): Promise<void> {
  await seedCaseIfMissing(
    caseService,
    traceService,
    "shadow-router-laundering-pattern",
    DEMO_TRACE_REQUEST,
    "Shadow Router Laundering Pattern",
    "A demo fraud case showing fan-out, bridge usage, mixer touchpoints, and exchange sink consolidation.",
    "This seeded case begins with a compromised wallet on Ethereum and follows the stolen funds through rapid hops, a Stargate bridge transfer into BSC, a mixer touchpoint, and eventual sink consolidation into exchange deposit wallets."
  );

  await seedCaseIfMissing(
    caseService,
    traceService,
    "nomad-bridge-exploit-demo",
    NOMAD_TRACE_REQUEST,
    "Nomad Bridge Exploit Demo",
    "A public-knowledge laundering pattern inspired by the August 2022 Nomad bridge exploit, showing copycat fan-out, rapid hops, mixer touchpoints, and a bridge-led exchange sink.",
    "This seeded case models the publicly documented Nomad bridge exploit pattern: one seed exploiter fans stolen funds out to five copycat wallets within minutes, each chain of wallets performs rapid follow-on hops, one path cashes out through a mixer, another bridges into BSC, and the destination-side beneficiary consolidates the bridged value into an exchange sink."
  );
}

async function seedCaseIfMissing(
  caseService: CaseService,
  traceService: TraceService,
  slug: string,
  request: typeof DEMO_TRACE_REQUEST,
  title: string,
  summary: string,
  narrative: string
): Promise<void> {
  const existing = await caseService.findBySlug(slug);
  if (existing) {
    return;
  }

  const trace = await traceService.createTrace(request, { preferInline: true });
  if (trace.status !== "completed") {
    return;
  }

  await caseService.createCase(
    {
      traceId: trace.id,
      title,
      summary,
      narrative
    },
    slug
  );
}
