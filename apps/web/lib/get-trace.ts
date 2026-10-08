import { fetchTrace, type TraceSubmissionResponse } from "./api";
import { getDemoTraceRecord } from "./demo-trace";
import type { TraceableChain } from "@kadenatrace/shared/client";

// In-memory cache to prevent duplicate API calls for the same trace
const traceCache = new Map<string, TraceSubmissionResponse>();

export async function getTrace(
  input: string,
  seedType: "address" | "tx" = "address",
  chain: TraceableChain = "ethereum"
) {
  const cacheKey = `${chain}:${seedType}:${input}`;
  if (traceCache.has(cacheKey)) {
    return { data: traceCache.get(cacheKey)!, isDemo: false };
  }

  try {
    const payload = {
      chain,
      seedType,
      seedValue: input.trim()
    };
    const data = await fetchTrace(payload);
    
    // Store in cache
    traceCache.set(cacheKey, data);
    
    return { data, isDemo: false };
  } catch (err) {
    console.error("fetchTrace failed, falling back to demo:", err);
    // Add artificial delay to make the fallback feel natural
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const demoData = await getDemoTraceRecord();
    const mockResponse: TraceSubmissionResponse = {
      ...demoData,
      traceId: "demo",
    };
    
    return { data: mockResponse, isDemo: true };
  }
}
