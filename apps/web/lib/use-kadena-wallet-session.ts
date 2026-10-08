"use client";

import { isSignedTransaction, type ICommand, type IUnsignedCommand } from "@kadena/client";
import { useKadenaWallet } from "@kadena/wallet-adapter-react";
import type { WalletSignerDescriptor } from "@kadenatrace/pact";
import { useEffect, useState } from "react";

const TARGET_NETWORK = process.env.NEXT_PUBLIC_KADENA_NETWORK_ID ?? "testnet04";

export function useKadenaWalletSession() {
  const { client, providerData, currentAdapterName, setCurrentAdapterName, state, setState } = useKadenaWallet();
  const [walletError, setWalletError] = useState<string | null>(null);

  const detectedAdapters = providerData.filter((provider) => provider.detected);
  const activeAdapterDetected = currentAdapterName
    ? detectedAdapters.some((provider) => provider.name === currentAdapterName)
    : false;

  useEffect(() => {
    if (!currentAdapterName && detectedAdapters[0]) {
      setCurrentAdapterName(detectedAdapters[0].name);
    }
  }, [currentAdapterName, detectedAdapters, setCurrentAdapterName]);

  useEffect(() => {
    if (!currentAdapterName || !activeAdapterDetected) {
      if (!currentAdapterName) {
        setWalletError(null);
      }
      setState({
        loading: false,
        accounts: [],
        activeAccount: null,
        networks: [],
        activeNetwork: null
      });
      return;
    }

    let cancelled = false;

    (async () => {
      setState({
        loading: true,
        accounts: [],
        activeAccount: null,
        networks: [],
        activeNetwork: null
      });

      const [accounts, activeAccount, networks, activeNetwork] = await Promise.allSettled([
        client.getAccounts(currentAdapterName),
        client.getActiveAccount(currentAdapterName),
        client.getNetworks(currentAdapterName),
        client.getActiveNetwork(currentAdapterName)
      ]);

      if (cancelled) {
        return;
      }

      setState({
        loading: false,
        accounts: accounts.status === "fulfilled" ? accounts.value : [],
        activeAccount: activeAccount.status === "fulfilled" ? activeAccount.value : null,
        networks: networks.status === "fulfilled" ? networks.value : [],
        activeNetwork: activeNetwork.status === "fulfilled" ? activeNetwork.value : null
      });
    })().catch((error: unknown) => {
      if (!cancelled) {
        setWalletError(error instanceof Error ? error.message : "Unable to read the active wallet state.");
        setState({
          loading: false
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeAdapterDetected, client, currentAdapterName, setState]);

  useEffect(() => {
    if (!currentAdapterName || !activeAdapterDetected) {
      return;
    }

    try {
      client.onAccountChange(currentAdapterName, (account) => {
        setState({
          activeAccount: account
        });
      });

      client.onNetworkChange(currentAdapterName, (network) => {
        setState({
          activeNetwork: network
        });
      });
      setWalletError(null);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Unable to watch the selected wallet.");
    }
  }, [activeAdapterDetected, client, currentAdapterName, setState]);

  const activeAccount = state.activeAccount;
  const activeNetwork = state.activeNetwork;
  const publicKey = activeAccount?.keyset.keys[0] ?? derivePublicKey(activeAccount?.accountName);
  const signer: WalletSignerDescriptor | null =
    activeAccount && publicKey
      ? {
          accountName: activeAccount.accountName,
          publicKey,
          adapterName: currentAdapterName ?? undefined
        }
      : null;

  const networkMismatch = Boolean(activeNetwork && activeNetwork.networkId !== TARGET_NETWORK);

  async function connect() {
    if (!currentAdapterName || !activeAdapterDetected) {
      setWalletError("Select a detected signing wallet first.");
      return;
    }

    try {
      setWalletError(null);
      await client.connect(currentAdapterName);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Unable to connect to the selected wallet.");
    }
  }

  async function disconnect() {
    if (!currentAdapterName || !activeAdapterDetected) {
      return;
    }

    try {
      setWalletError(null);
      await client.disconnect(currentAdapterName);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Unable to disconnect the current wallet.");
    }
  }

  async function switchToTargetNetwork() {
    if (!currentAdapterName || !activeAdapterDetected) {
      return;
    }

    try {
      setWalletError(null);
      await client.request(currentAdapterName, {
        method: "kadena_changeNetwork_v1",
        params: {
          networkId: TARGET_NETWORK
        }
      });
    } catch (error) {
      setWalletError(
        error instanceof Error ? error.message : `Unable to switch the wallet to ${TARGET_NETWORK}.`
      );
    }
  }

  async function signTransaction(unsignedCommand: IUnsignedCommand): Promise<ICommand> {
    if (!currentAdapterName || !activeAdapterDetected) {
      throw new Error("No signing wallet adapter is selected.");
    }

    const signed = await client.signTransaction(currentAdapterName, unsignedCommand);
    const signedCommand = Array.isArray(signed) ? signed[0] : signed;
    if (!signedCommand || !isSignedTransaction(signedCommand)) {
      throw new Error("The wallet did not return a fully signed command.");
    }

    return signedCommand;
  }

  return {
    detectedAdapters,
    currentAdapterName,
    setCurrentAdapterName,
    activeAccount,
    activeNetwork,
    networkMismatch,
    targetNetworkId: TARGET_NETWORK,
    signer,
    walletError,
    loading: state.loading,
    connect,
    disconnect,
    switchToTargetNetwork,
    signTransaction
  };
}

function derivePublicKey(accountName?: string): string | null {
  if (!accountName) {
    return null;
  }

  return accountName.startsWith("k:") ? accountName.slice(2) : null;
}
