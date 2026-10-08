import { useState } from "react";
import { Check, Copy, ShieldCheck, Terminal } from "lucide-react";
import { buttonStyles } from "./ui";

interface Props {
  traceHash: string;
}

export const VerificationStrip = ({ traceHash }: Props) => {
  const [copied, setCopied] = useState<"hash" | "cli" | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const copy = async (text: string, key: "hash" | "cli"): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setCopyError(null);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopyError("Clipboard access is unavailable in this browser context.");
    }
  };

  const shortHash = `${traceHash.slice(0, 10)}…${traceHash.slice(-8)}`;
  const cliCmd = `npm run verify-trace -- ${traceHash}`;

  return (
    <section className="w-full border-b border-border bg-surface shadow-sm">
      <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-verified-bg px-3 py-1 text-xs font-medium text-verified">
            <ShieldCheck className="h-3.5 w-3.5" />
            Trace hash available
          </span>

          <button
            onClick={() => copy(traceHash, "hash")}
            className="group inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 font-mono text-xs text-foreground/80 transition-smooth hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-background"
            title="Copy trace hash"
            aria-label="Copy trace hash"
          >
            <span className="text-muted-foreground">Trace:</span>
            <span>{shortHash}</span>
            {copied === "hash" ? (
              <Check className="h-3.5 w-3.5 text-verified" />
            ) : (
              <Copy className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
            )}
          </button>

          <span className="hidden text-xs text-muted-foreground sm:inline">The trace hash supports independent integrity checks against this report.</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => copy(cliCmd, "cli")}
            className={`${buttonStyles("secondary")} self-start lg:self-auto`}
            aria-label="Copy CLI verification command"
          >
            <Terminal className="h-3.5 w-3.5" />
            {copied === "cli" ? "Copied!" : "Verify via CLI"}
          </button>
          {copyError ? <span className="text-xs text-red-700">{copyError}</span> : null}
        </div>
      </div>
    </section>
  );
};
