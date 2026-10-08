"use client";

import type { PreparedWalletAttestationPayload } from "@kadenatrace/pact";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import type { Chain, PublicCaseView, RiskLevel } from "@kadenatrace/shared/client";

import { getApiBaseUrl } from "../lib/api";
import { useKadenaWalletSession } from "../lib/use-kadena-wallet-session";
import { buttonStyles } from "./ui";

export function AttestationPanel({ fraudCase }: { fraudCase: PublicCaseView }): ReactElement {
  const wallet = useKadenaWalletSession();
  const router = useRouter();
  const [subjectWallet, setSubjectWallet] = useState(fraudCase.seed.seedValue);
  const [chain, setChain] = useState<Chain>(fraudCase.seed.chain);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("high");
  const [riskScore, setRiskScore] = useState(78);
  const [note, setNote] = useState("Linked to the public trace snapshot and suspicious flow shown in this case.");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submitAttestation() {
    if (!wallet.signer) {
      setStatus("Connect a compatible signing wallet before publishing an attestation.");
      return;
    }
    if (wallet.networkMismatch) {
      setStatus(`Switch the wallet to ${wallet.targetNetworkId} before signing.`);
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      const payloadResponse = await fetch(`${getApiBaseUrl()}/api/cases/${fraudCase.caseId}/attestations/payload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          signer: wallet.signer,
          attestation: {
            wallet: subjectWallet,
            chain,
            riskLevel,
            riskScore,
            note
          }
        })
      });
      const payload = (await payloadResponse.json()) as PreparedWalletAttestationPayload & { error?: string };
      if (!payloadResponse.ok || !payload.unsignedCommand) {
        throw new Error(payload.error ?? "Unable to prepare the attestation payload.");
      }

      const signedCommand = await wallet.signTransaction(payload.unsignedCommand);
      const submitResponse = await fetch(`${getApiBaseUrl()}/api/cases/${fraudCase.caseId}/attestations/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          signer: wallet.signer,
          attestation: {
            wallet: subjectWallet,
            chain,
            riskLevel,
            riskScore,
            note
          },
          signedCommand
        })
      });
      const submitted = (await submitResponse.json()) as {
        caseId?: string;
        attestations?: Array<{ requestKey?: string; status?: string }>;
        error?: string;
      };
      if (!submitResponse.ok || !submitted.caseId) {
        throw new Error(submitted.error ?? "Unable to submit the attestation.");
      }

      const latest = submitted.attestations?.[submitted.attestations.length - 1];
      setStatus(
        latest?.requestKey
          ? `Attestation ${latest.status ?? "submitted"} with request key ${latest.requestKey}.`
          : "Attestation submitted."
      );
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to submit the attestation.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel stack">
      <div className="page-header">
        <div>
          <span className="pill">Wallet Attestation</span>
          <h2 className="section-title">Sign a public risk attestation</h2>
        </div>
      </div>
      <div className="publish-form grid">
        <div className="trace-meta">
          <span className="pill">{wallet.currentAdapterName ?? "Wallet not selected"}</span>
          <span className="muted">{wallet.signer?.accountName ?? "Connect a wallet to attest"}</span>
        </div>
        <label>
          Wallet to flag
          <input value={subjectWallet} onChange={(event) => setSubjectWallet(event.target.value)} />
        </label>
        <label>
          Chain
          <select value={chain} onChange={(event) => setChain(event.target.value as Chain)}>
            <option value="ethereum">Ethereum</option>
            <option value="bsc">BNB Chain</option>
            <option value="bitcoin">Bitcoin</option>
            <option value="xrpl">XRP Ledger</option>
            <option value="solana">Solana</option>
          </select>
        </label>
        <label>
          Risk level
          <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as RiskLevel)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label>
          Risk score
          <input
            type="number"
            min={0}
            max={100}
            value={riskScore}
            onChange={(event) => setRiskScore(Number(event.target.value))}
          />
        </label>
        <label>
          Public note
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <div className="actions">
          <button className={buttonStyles("primary")} type="button" disabled={pending || !wallet.signer} onClick={submitAttestation}>
            {pending ? "Submitting..." : "Sign & Publish Attestation"}
          </button>
        </div>
        {status ? (
          <p className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground" aria-live="polite">
            {status}
          </p>
        ) : null}
      </div>
    </section>
  );
}
