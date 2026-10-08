"use client";

import { KadenaWalletProvider } from "@kadena/wallet-adapter-react";
import { createChainweaverLegacyAdapter } from "@kadena/wallet-adapter-chainweaver-legacy";
import { createEckoAdapter } from "@kadena/wallet-adapter-ecko";
import { type ReactNode, useEffect, useState } from "react";

export function WalletProviders({ children }: { children: ReactNode }) {
  // Use state to hold adapters, initializing as empty to match SSR and avoid hydration disparities.
  // Keep adapter typing isolated from wallet-provider package internals.
  const [adapters, setAdapters] = useState<any[]>([]);

  useEffect(() => {
    setAdapters([createEckoAdapter(), createChainweaverLegacyAdapter()]);
  }, []);

  return (
    <KadenaWalletProvider adapters={adapters}>
      {children}
    </KadenaWalletProvider>
  );
}
