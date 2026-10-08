"use client";

import { useState, type ReactElement } from "react";

interface CLIModalProps {
  isOpen: boolean;
  onClose: () => void;
  traceHash: string;
}

export function CLIModal({ isOpen, onClose, traceHash }: CLIModalProps): ReactElement | null {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const cliCommand = `npm run verify-trace -- ${traceHash}`;

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(cliCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px"
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(4px)"
        }}
      />

      <div
        className="panel"
        style={{
          position: "relative",
          maxWidth: "520px",
          width: "100%",
          padding: "32px"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="section-title" style={{ fontSize: "1.25rem", marginBottom: "8px" }}>
          Verify via CLI
        </h2>

        <p className="muted" style={{ marginBottom: "24px", fontSize: "14px", lineHeight: 1.6 }}>
          Run this command to independently verify the trace using the CryptoTrace CLI.
        </p>

        <div
          style={{
            background: "var(--bg)",
            padding: "16px",
            borderRadius: "12px",
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            marginBottom: "24px",
            overflow: "auto"
          }}
        >
          <code style={{ color: "var(--primary)" }}>{cliCommand}</code>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button className="button" onClick={handleCopy}>
            {copied ? "✓ Copied!" : "Copy Command"}
          </button>

          <button className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="muted" style={{ fontSize: "12px", marginTop: "20px" }}>
          This creates a locally-verified proof that can be used in legal proceedings.
        </p>
      </div>
    </div>
  );
}
