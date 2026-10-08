import { randomUUID } from "node:crypto";

import type { TraceRecord, TraceRequest } from "@kadenatrace/shared";
import { TraceEngine } from "@kadenatrace/shared/server";
import { createDefaultActivityProvider } from "@kadenatrace/shared";

import type { TraceRepository } from "../repositories/contracts.js";
import { BullMqTraceQueue } from "./trace-queue.js";

interface CreateTraceOptions {
  preferInline?: boolean;
}

export class TraceService {
  private readonly engine: TraceEngine;

  constructor(
    private readonly traceRepository: TraceRepository,
    covalentApiKey?: string,
    ethereumRpcUrl?: string,
    bscRpcUrl?: string,
    bitcoinMempoolUrl?: string,
    private readonly queue?: BullMqTraceQueue,
    solanaRpcUrl?: string,
    xrplRpcUrl?: string
  ) {
    const provider = createDefaultActivityProvider({
      covalentApiKey,
      ethereumRpcUrl,
      bscRpcUrl,
      mempoolBaseUrl: bitcoinMempoolUrl,
      solanaRpcUrl,
      xrplRpcUrl
    });
    this.engine = new TraceEngine(provider);
  }

  async createTrace(request: TraceRequest, options: CreateTraceOptions = {}): Promise<TraceRecord> {
    const traceId = randomUUID();
    const now = new Date().toISOString();
    const trace: TraceRecord = {
      id: traceId,
      request,
      status: this.queue && !options.preferInline ? "queued" : "running",
      createdAt: now,
      updatedAt: now
    };

    await this.traceRepository.save(trace);

    if (this.queue && !options.preferInline) {
      await this.queue.enqueue({ traceId, request });
      trace.status = "queued";
      trace.updatedAt = new Date().toISOString();
      await this.traceRepository.update(trace);
      return trace;
    }

    return this.processTrace(traceId, request, trace.createdAt);
  }

  async processTrace(traceId: string, request: TraceRequest, createdAt?: string): Promise<TraceRecord> {
    const started = new Date().toISOString();
    const trace: TraceRecord = {
      id: traceId,
      request,
      status: "running",
      createdAt: createdAt ?? started,
      updatedAt: started
    };
    await this.traceRepository.save(trace);

    try {
      const result = await this.engine.run(request, traceId);
      const completed: TraceRecord = {
        ...trace,
        status: "completed",
        result,
        updatedAt: new Date().toISOString()
      };
      await this.traceRepository.update(completed);
      return completed;
    } catch (error) {
      const failed: TraceRecord = {
        ...trace,
        status: "failed",
        error: error instanceof Error ? error.message : "Trace execution failed.",
        updatedAt: new Date().toISOString()
      };
      await this.traceRepository.update(failed);
      return failed;
    }
  }

  async getTrace(traceId: string): Promise<TraceRecord | null> {
    return this.traceRepository.findById(traceId);
  }
}
