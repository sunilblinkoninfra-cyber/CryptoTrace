import "./globals.css";

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Activity } from "lucide-react";

import { WalletProviders } from "../components/wallet-providers";

export const metadata: Metadata = {
  title: "CryptoTrace | Multi-chain Investigations",
  description: "Explainable blockchain tracing across Bitcoin, Ethereum, BNB Chain, XRP Ledger, and Solana."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-slate-800 font-sans selection:bg-sky-200/50 selection:text-slate-900" suppressHydrationWarning>
        <WalletProviders>
          <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/70 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6">
              <Link
                href="/"
                className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-glow">
                  <Activity className="h-5.5 w-5.5" />
                </div>
                <span className="truncate font-display text-base font-extrabold tracking-wider text-slate-800 sm:text-lg">
                  CryptoTrace
                </span>
              </Link>

              <nav className="flex shrink-0 items-center gap-6 text-sm font-bold">
                <Link
                  href="/"
                  className="text-slate-600 transition-colors hover:text-sky-600 focus:outline-none focus:text-sky-600"
                >
                  Trace
                </Link>
                <Link
                  href="/waterfall"
                  className="text-slate-600 transition-colors hover:text-sky-600 focus:outline-none focus:text-sky-600"
                >
                  Waterfall
                </Link>
                <Link
                  href="/attestations"
                  className="text-slate-600 transition-colors hover:text-sky-600 focus:outline-none focus:text-sky-600"
                >
                  Attestations
                </Link>
              </nav>
            </div>
          </header>

          <div className="relative flex min-h-[calc(100vh-4rem)] flex-col">{children}</div>
        </WalletProviders>
      </body>
    </html>
  );
}
