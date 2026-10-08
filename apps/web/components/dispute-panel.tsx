// dispute-panel.tsx -- Interactive panel for raising an on-chain dispute via the raise-dispute defpact.
"use client";

import type { ICommand, IUnsignedCommand } from "@kadena/client";
import { useState, type FormEvent, type ReactElement } from "react";

import { prepareDisputePayload, submitDisputeCommand } from "../lib/api";
import { useKadenaWalletSession } from "../lib/use-kadena-wallet-session";
import { buttonStyles } from "./ui";

interface DisputePanelProps {
  caseId: string;
  caseSlug: string;
}

type PreparedDisputePayload = {
  disputeId?: string;
  unsignedCommand: IUnsignedCommand;
};

type DisputeStep =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "awaiting-signature"; payload: unknown }
  | { kind: "submitting" }
  | { kind: "success"; disputeId: string; requestKey: string }
  | { kind: "error"; message: string };

export function DisputePanel({ caseId, caseSlug }: DisputePanelProps): ReactElement {
  const { networkMismatch, signer, signTransaction, targetNetworkId } = useKadenaWalletSession();
  const isConnected = Boolean(signer);
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<DisputeStep>({ kind: "idle" });
  const [reasonHash, setReasonHash] = useState<string | null>(null);

  const computeHash = async (text: string): Promise<string> => {
    const encoded = new TextEncoder().encode(text);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const handlePrepare = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!reason.trim() || !isConnected || !signer) {
      return;
    }
    if (networkMismatch) {
      setStep({
        kind: "error",
        message: `Switch the wallet to ${targetNetworkId} before preparing the dispute.`
      });
      return;
    }

    setStep({ kind: "preparing" });

    try {
      const hash = await computeHash(reason.trim());
      setReasonHash(hash);

      const payload = await prepareDisputePayload(caseId, {
        reasonHash: hash,
        signer: {
          accountName: signer.accountName,
          publicKey: signer.publicKey,
          adapterName: signer.adapterName
        }
      });

      setStep({ kind: "awaiting-signature", payload });
    } catch (err) {
      setStep({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to prepare dispute."
      });
    }
  };

  const handleSign = async (): Promise<void> => {
    if (step.kind !== "awaiting-signature" || !signer) {
      return;
    }
    if (networkMismatch) {
      setStep({
        kind: "error",
        message: `Switch the wallet to ${targetNetworkId} before signing the dispute.`
      });
      return;
    }

    setStep({ kind: "submitting" });

    try {
      const prepared = step.payload as PreparedDisputePayload;
      const signedCommand: ICommand = await signTransaction(prepared.unsignedCommand);
      const result = await submitDisputeCommand(caseId, {
        disputeId: prepared.disputeId ?? `dispute-${Date.now()}`,
        signer: {
          accountName: signer.accountName,
          publicKey: signer.publicKey
        },
        signedCommand
      });

      setStep({
        kind: "success",
        disputeId: result.disputeId,
        requestKey: result.requestKey ?? signedCommand.hash
      });
    } catch (err) {
      setStep({
        kind: "error",
        message: err instanceof Error ? err.message : "Dispute submission failed."
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="panel">
        <p className="muted">
          Connect an Ecko or Chainweaver wallet on testnet04 to raise a dispute.
        </p>
      </div>
    );
  }

  if (step.kind === "success") {
    return (
      <div className="panel stack">
        <p className="text-sm font-medium text-green-700">Dispute submitted on-chain.</p>
        <div className="facts">
          <span className="muted">Dispute ID: <span className="code">{step.disputeId}</span></span>
          <span className="muted">Request key: <span className="code">{step.requestKey}</span></span>
        </div>
        <p className="text-sm text-muted-foreground">
          The governance keyset must complete step 2 of the defpact to mark
          this dispute as reviewed.
        </p>
      </div>
    );
  }

  return (
    <div className="panel stack">
      <form onSubmit={(event) => void handlePrepare(event)}>
        <div className="grid gap-4">
          <label htmlFor="dispute-reason" className="grid gap-2 text-sm font-medium text-foreground">
            Dispute reason
            <textarea
              id="dispute-reason"
              className="input min-h-[140px] py-3"
              rows={4}
              placeholder="Describe why this case was anchored in error. This text will be hashed and committed on-chain."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={step.kind !== "idle" && step.kind !== "error"}
            />
          </label>
          {reasonHash ? (
            <div className="facts">
              <span className="text-sm text-muted-foreground">
                SHA-256 reason hash (stored on-chain):
              </span>
              <span className="code">
                {reasonHash}
              </span>
            </div>
          ) : null}
          {step.kind === "error" ? (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">{step.message}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {step.kind === "awaiting-signature" ? (
              <button
                className={buttonStyles("primary")}
                type="button"
                onClick={() => void handleSign()}
              >
                Sign & submit dispute
              </button>
            ) : (
              <button
                className={buttonStyles("secondary")}
                type="submit"
                disabled={
                  !reason.trim() ||
                  step.kind === "preparing" ||
                  step.kind === "submitting"
                }
              >
                {step.kind === "preparing"
                  ? "Preparing transaction..."
                  : step.kind === "submitting"
                    ? "Submitting..."
                    : "Prepare dispute transaction"}
              </button>
            )}
            {(step.kind === "preparing" || step.kind === "submitting") ? (
              <span className="self-center text-sm text-muted-foreground">
                {step.kind === "preparing"
                  ? "Hashing reason and building Pact command..."
                  : "Waiting for chain confirmation..."}
              </span>
            ) : null}
          </div>
        </div>
      </form>
      <p className="text-sm text-muted-foreground">
        Case ID: <span className="code">{caseId}</span>. Public slug: <span className="code">{caseSlug}</span>.
        Your dispute opens step 1 of the <code>raise-dispute</code> defpact.
        Step 2 requires the governance keyset to mark it reviewed.
      </p>
    </div>
  );
}
