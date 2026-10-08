import type { CaseAnchor } from "@kadenatrace/shared/client";
import { Card } from "./ui";

export function CaseAnchorCard({ anchor }: { anchor?: CaseAnchor }) {
  return (
    <Card className="grid gap-5 p-5 bg-gradient-to-br from-white/95 to-slate-50/50 border-slate-200/60 rounded-2xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200/60 pb-3">
        <span className="pill font-display text-[10px] uppercase tracking-wider">Public ledger anchor</span>
        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {anchor?.status ?? "not anchored"}
        </span>
      </div>
      {anchor ? (
        <div className="grid gap-3 text-xs font-bold text-slate-600 leading-relaxed">
          <p>
            Request Key: <span className="rounded bg-slate-100 border border-slate-200/60 px-2 py-0.5 font-mono text-[11px] text-slate-700">{anchor.requestKey}</span>
          </p>
          <p>
            Chain Alignment: <span className="text-slate-800 font-extrabold">Chain {anchor.chainId}</span> on <span className="text-slate-800 font-extrabold">{anchor.networkId}</span>
          </p>
          <p>
            Metadata Hash: <span className="rounded bg-slate-100 border border-slate-200/60 px-2 py-0.5 font-mono text-[11px] text-slate-700">{anchor.metadataHash}</span>
          </p>
          {anchor.signerAccount ? (
            <p>
              Signer Account: <span className="rounded bg-slate-100 border border-slate-200/60 px-2 py-0.5 font-mono text-[11px] text-slate-700">{anchor.signerAccount}</span>
            </p>
          ) : null}
          {anchor.signerPublicKey ? (
            <p>
              Signer Public Key: <span className="rounded bg-slate-100 border border-slate-200/60 px-2 py-0.5 font-mono text-[11px] text-slate-700">{anchor.signerPublicKey}</span>
            </p>
          ) : null}
          {anchor.blockHeight ? (
            <p>
              Block Height: <span className="text-slate-800 font-extrabold font-mono">{anchor.blockHeight}</span>
            </p>
          ) : null}
          {anchor.error ? (
            <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-3.5 mt-2">
              {anchor.error}
            </p>
          ) : null}
          {anchor.txPreview ? (
            <div className="grid gap-2 mt-2">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-display">Command Payload Preview</h4>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-mono text-[10px] font-bold text-slate-600 shadow-inner">
                {anchor.txPreview}
              </pre>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-slate-400 font-semibold">
          This forensic investigation case has not been anchored on-chain yet. Create a public case to configure anchor signing.
        </p>
      )}
    </Card>
  );
}
