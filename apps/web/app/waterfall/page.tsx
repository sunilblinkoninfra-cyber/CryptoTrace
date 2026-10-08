import type { Metadata } from "next";
import type { ReactElement } from "react";

import { TraceWaterfall } from "../../components/trace-waterfall";
import { PageShell } from "../../components/ui";
import { DEMO_TRACE_ID, buildDemoTraceSpans } from "../../lib/trace-waterfall-demo";

export const metadata: Metadata = {
  title: "Trace Waterfall | CryptoTrace",
  description: "A Jaeger-style observability waterfall built with deterministic span scaling."
};

export default function WaterfallPage(): ReactElement {
  const spans = buildDemoTraceSpans();

  return (
    <PageShell>
      <TraceWaterfall traceId={DEMO_TRACE_ID} spans={spans} />
    </PageShell>
  );
}
