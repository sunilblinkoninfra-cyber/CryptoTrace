import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import { AttestationPanel } from "../../../components/attestation-panel";
import { CaseAnchorCard } from "../../../components/case-anchor-card";
import { CopyShareLinkButton } from "../../../components/copy-share-link-button";
import { DisputePanel } from "../../../components/dispute-panel";
import { RiskBadge } from "../../../components/risk-badge";
import { TraceOverview } from "../../../components/trace-overview";
import { ErrorStateCard, PageShell, buttonStyles } from "../../../components/ui";
import { WalletConnectionCard } from "../../../components/wallet-connection-card";
import { fetchCase } from "../../../lib/api";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const caseData = await fetchCase(slug);

  if (!caseData) {
    return {
      title: "Case not found | CryptoTrace",
      description: "CryptoTrace public investigation"
    };
  }

  return {
    title: `${caseData.title} | CryptoTrace`,
    description: caseData.summary,
    openGraph: {
      title: `${caseData.title} | CryptoTrace`,
      description: caseData.summary,
      type: "article",
      url: `https://cryptotrace.vercel.app/case/${slug}`
    },
    twitter: {
      card: "summary",
      title: `${caseData.title} | CryptoTrace`,
      description: caseData.summary
    }
  };
}

export default async function PublicCasePage({ params }: { params: Promise<{ slug: string }> }): Promise<ReactElement> {
  const { slug } = await params;
  const fraudCase = await fetchCase(slug);
  const disputeFlowEnabled = process.env.DISPUTE_FLOW_ENABLED === "true";

  if (!fraudCase) {
    return (
      <PageShell>
        <ErrorStateCard
          title="Public case not found"
          message="The share link may be wrong, or the public case is not available yet."
        >
          <Link href="/" className={buttonStyles("secondary")}>
            Back to dashboard
          </Link>
        </ErrorStateCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className={getVerificationBannerClassName(fraudCase.anchor?.status)}>
        {fraudCase.anchor?.status === "confirmed"
          ? `✓ Anchored on public ledger — Block ${fraudCase.anchor.blockHeight ?? "pending"} — Request Key: ${fraudCase.anchor.requestKey}`
          : fraudCase.anchor
            ? "⏳ Anchor transaction submitted, awaiting ledger validation confirmation..."
            : "⚠ Not yet anchored on-chain — anchor this case via the trace verification dashboard"}
      </div>

      <section className="rounded-2xl border border-white/50 bg-white/70 p-5 shadow-glow backdrop-blur-md stack">
        <div className="page-header flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="pill">Public Fraud Case</span>
            <h1 className="section-title mt-1.5 font-display text-2xl font-black text-slate-800">
              {fraudCase.title}
            </h1>
            <p className="lede mt-2 text-sm leading-relaxed text-slate-600 font-semibold">{fraudCase.summary}</p>
          </div>
          <div className="actions flex flex-wrap gap-2.5">
            <CopyShareLinkButton />
            {disputeFlowEnabled ? (
              <a href="#dispute-flow" className={`${buttonStyles("secondary")} font-bold text-xs`}>
                Raise Dispute
              </a>
            ) : null}
            <Link href="/" className={`${buttonStyles("secondary")} font-bold text-xs`}>
              New Trace
            </Link>
          </div>
        </div>
        <div className="trace-meta text-xs font-bold text-slate-500 mt-4 border-t border-slate-200/60 pt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
            {fraudCase.seed.seedValue}
          </span>
          <span className="pill text-[9px] uppercase tracking-wider">{fraudCase.seed.chain}</span>
          <span>Updated {new Date(fraudCase.updatedAt).toLocaleString()}</span>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/50 bg-white/70 p-5 shadow-sm stack">
          <h2 className="text-lg font-black text-slate-800 font-display border-b border-slate-200/60 pb-2">
            Case Narrative
          </h2>
          <p className="text-sm font-semibold leading-relaxed text-slate-600 whitespace-pre-wrap mt-3">
            {fraudCase.narrative}
          </p>
          
          <h3 className="text-base font-extrabold text-slate-800 font-display border-b border-slate-200/60 pb-2 mt-6">
            Evidence References
          </h3>
          <div className="grid gap-3.5 mt-3">
            {fraudCase.sourceRefs.map((source) => (
              <article 
                key={source.id} 
                className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm flex flex-col gap-2 hover:border-sky-300 transition-colors"
              >
                <div className="trace-meta text-xs font-bold flex items-center gap-2">
                  <span className="pill text-[9px] uppercase tracking-wider">{source.type}</span>
                  {source.chain ? (
                    <span className="font-mono text-[10px] bg-slate-100 border px-1.5 py-0.5 rounded">
                      {source.chain}
                    </span>
                  ) : null}
                </div>
                <p className="break-all text-sm font-bold text-slate-700 leading-relaxed">
                  {source.label}
                </p>
                {source.url ? (
                  <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className={`${buttonStyles("secondary")} font-bold text-xs w-fit py-1.5 px-3 mt-1`}
                  >
                    Open Source Evidence
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </article>
        
        <div className="grid gap-6 self-start">
          <WalletConnectionCard />
          <CaseAnchorCard anchor={fraudCase.anchor} />
        </div>
      </section>

      <TraceOverview
        trace={fraudCase.trace}
        traceId={fraudCase.trace.traceId}
        graphTitle="Frozen Forensic Trace Snapshot"
        graphSubtitle="This public case registry replays the frozen node transaction graph and automated path audits that back the published narrative."
        showVerificationStrip={false}
        autoScrollSummary={false}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <AttestationPanel fraudCase={fraudCase} />
        <article className="rounded-2xl border border-white/50 bg-white/70 p-5 shadow-sm stack">
          <h2 className="text-lg font-black text-slate-800 font-display border-b border-slate-200/60 pb-2">
            Published Attestations
          </h2>
          <div className="grid gap-3.5 mt-4">
            {fraudCase.attestations.length > 0 ? (
              fraudCase.attestations.map((attestation, index) => (
                <article 
                  key={`${attestation.requestKey ?? attestation.attestationId ?? index}`} 
                  className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm flex flex-col gap-2.5 hover:border-sky-300 transition-colors"
                >
                  <div className="trace-meta text-xs font-bold flex items-center gap-2">
                    <span className="pill text-[9px] uppercase tracking-wider">{attestation.chain}</span>
                    <RiskBadge level={attestation.riskLevel} />
                  </div>
                  <p className="break-all text-sm font-bold text-slate-700 leading-relaxed">
                    {attestation.wallet} scored <span className="text-sky-600 font-extrabold">{attestation.riskScore}/100</span> by {attestation.signer}
                  </p>
                  {attestation.note ? (
                    <p className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
                      {attestation.note}
                    </p>
                  ) : null}
                  {attestation.requestKey ? (
                    <span className="font-mono text-[10px] bg-slate-100 border border-slate-200/60 px-2 py-1 rounded w-fit break-all">
                      {attestation.requestKey}
                    </span>
                  ) : null}
                  {attestation.blockHeight ? (
                    <p className="text-[10px] font-bold text-slate-400">Block Height: {attestation.blockHeight}</p>
                  ) : null}
                </article>
              ))
            ) : (
              <article className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-xs font-semibold text-slate-400">No blockchain attestations have been published for this report yet.</p>
              </article>
            )}
          </div>
        </article>
      </section>

      {disputeFlowEnabled ? (
        <section id="dispute-flow" className="rounded-2xl border border-white/50 bg-white/70 p-5 shadow-sm stack">
          <h2 className="text-lg font-black text-slate-800 font-display border-b border-slate-200/60 pb-2">
            Dispute This Investigation
          </h2>
          <p className="text-sm font-semibold leading-relaxed text-slate-500 mt-3">
            If you believe this case was anchored incorrectly, raise a formal on-chain dispute. Your reason is hashed
            locally before being committed — the raw text never leaves your browser. Step 2 requires the governance
            keyset to review and resolve.
          </p>
          <div className="mt-4">
            <DisputePanel caseId={fraudCase.caseId} caseSlug={fraudCase.slug} />
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}

function getVerificationBannerClassName(status: string | undefined): string {
  if (status === "confirmed") {
    return "rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-extrabold font-mono px-4 py-3.5 shadow-sm mb-6";
  }
  if (status) {
    return "rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-extrabold font-mono px-4 py-3.5 shadow-sm mb-6";
  }
  return "rounded-xl border border-slate-200 bg-slate-100 text-slate-600 text-xs font-semibold px-4 py-3.5 mb-6";
}
