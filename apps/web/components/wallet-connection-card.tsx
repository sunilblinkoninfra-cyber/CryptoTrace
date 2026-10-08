"use client";

import { useKadenaWalletSession } from "../lib/use-kadena-wallet-session";
import { Card, buttonStyles } from "./ui";

export function WalletConnectionCard() {
  const wallet = useKadenaWalletSession();

  return (
    <Card className="grid gap-5 p-5 bg-gradient-to-br from-white/95 to-slate-50/50 border-slate-200/60 rounded-2xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200/60 pb-3">
        <span className="pill font-display text-[10px] uppercase tracking-wider">Signing Wallet</span>
        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {wallet.targetNetworkId}
        </span>
      </div>
      <div className="grid gap-4.5">
        <label className="flex flex-col gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 font-display">
          Active Wallet Adapter
          <select
            className="input bg-white text-slate-800 font-medium border-slate-200/80 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 cursor-pointer"
            value={wallet.currentAdapterName ?? ""}
            onChange={(event) => wallet.setCurrentAdapterName(event.target.value || null)}
            aria-label="Wallet adapter"
          >
            {wallet.detectedAdapters.length === 0 ? <option value="">No wallet detected</option> : null}
            {wallet.detectedAdapters.map((adapter) => (
              <option key={adapter.name} value={adapter.name}>
                {adapter.name}
              </option>
            ))}
          </select>
        </label>
        
        <div className="grid gap-4 text-xs font-bold text-slate-500 md:grid-cols-2">
          <span className="truncate rounded-xl border border-slate-200/60 bg-white p-3.5 shadow-sm">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-display">Account</span>
            <span className="font-mono text-slate-700">{wallet.activeAccount?.accountName ?? "Not connected"}</span>
          </span>
          <span className="truncate rounded-xl border border-slate-200/60 bg-white p-3.5 shadow-sm">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-display">Network</span>
            <span className="font-mono text-slate-700">{wallet.activeNetwork?.networkId ?? "Unknown"}</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1.5">
          <button 
            className={`${buttonStyles("primary")} cursor-pointer font-bold text-xs shadow-glow`} 
            type="button" 
            onClick={wallet.connect}
          >
            {wallet.activeAccount ? "Reconnect Wallet" : "Connect Wallet"}
          </button>
          {wallet.activeAccount ? (
            <button 
              className={`${buttonStyles("secondary")} cursor-pointer font-bold text-xs`} 
              type="button" 
              onClick={wallet.disconnect}
            >
              Disconnect
            </button>
          ) : null}
          {wallet.networkMismatch ? (
            <button 
              className={`${buttonStyles("secondary")} cursor-pointer font-bold text-xs`} 
              type="button" 
              onClick={wallet.switchToTargetNetwork}
            >
              Switch to {wallet.targetNetworkId}
            </button>
          ) : null}
        </div>

        {wallet.walletError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            {wallet.walletError}
          </p>
        ) : null}
        
        {!wallet.currentAdapterName && wallet.detectedAdapters.length === 0 ? (
          <p className="text-xs leading-relaxed text-slate-400 font-medium">
            Connect a supported signing wallet to publish attestations and anchor investigation records.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
