"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import {
  isConnected,
  getAddress,
  getNetwork,
  requestAccess,
} from "@stellar/freighter-api";
import { Horizon } from "@stellar/stellar-sdk";

interface Balance {
  asset_code: string;
  balance: string;
  asset_type: string;
  asset_issuer?: string;
  usd_value: number;
}

interface WalletState {
  address: string | null;
  network: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  balances: Balance[];
  totalUsdValue: number;
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  fetchBalances: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const COINGECKO_IDS: Record<string, string> = {
  XLM: "stellar",
  USDC: "usd-coin",
  AQUA: "aqua",
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    network: null,
    isConnected: false,
    isLoading: false,
    error: null,
    balances: [],
    totalUsdValue: 0,
  });

  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  const getHorizonUrl = (network: string | null) => {
    return network?.toLowerCase() === "public"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";
  };

  const fetchBalances = useCallback(async () => {
    if (!state.address) return;

    try {
      const horizonUrl = getHorizonUrl(state.network);
      const server = new Horizon.Server(horizonUrl);
      const account = await server.loadAccount(state.address);

      // Fetch prices
      const assetIds = Object.values(COINGECKO_IDS).join(",");
      const priceRes = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${assetIds}&vs_currencies=usd`
      );
      const prices = await priceRes.json();

      let totalUsd = 0;
      const balances: Balance[] = account.balances.map((b: any) => {
        const code = b.asset_type === "native" ? "XLM" : b.asset_code;
        const coingeckoId = COINGECKO_IDS[code];
        const price = prices[coingeckoId]?.usd || (code === "USDC" ? 1 : 0);
        const usdValue = parseFloat(b.balance) * price;
        totalUsd += usdValue;

        return {
          asset_code: code,
          balance: b.balance,
          asset_type: b.asset_type,
          asset_issuer: b.asset_issuer,
          usd_value: usdValue,
        };
      });

      setState((s) => ({
        ...s,
        balances,
        totalUsdValue: totalUsd,
      }));
    } catch (err) {
      console.error("Failed to fetch balances:", err);
    }
  }, [state.address, state.network]);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const connected = await isConnected();
        if (connected?.isConnected) {
          const [addrResult, netResult] = await Promise.all([
            getAddress(),
            getNetwork(),
          ]);
          if (addrResult?.address) {
            setState((s) => ({
              ...s,
              address: addrResult.address,
              network: netResult?.network ?? null,
              isConnected: true,
              isLoading: false,
              error: null,
            }));
          }
        }
      } catch {
        // Freighter not installed or not connected — silent fail
      }
    })();
  }, []);

  // Fetch balances when address changes
  useEffect(() => {
    if (state.address) {
      fetchBalances();
      
      // Real-time updates every 30 seconds
      if (refreshInterval.current) clearInterval(refreshInterval.current);
      refreshInterval.current = setInterval(fetchBalances, 30000);
    } else {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
        refreshInterval.current = null;
      }
      setState((s) => ({ ...s, balances: [], totalUsdValue: 0 }));
    }

    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    };
  }, [state.address, fetchBalances]);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const accessResult = await requestAccess();
      if (accessResult?.error) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: accessResult.error ?? "Connection rejected",
        }));
        return;
      }
      const [addrResult, netResult] = await Promise.all([
        getAddress(),
        getNetwork(),
      ]);
      setState((s) => ({
        ...s,
        address: addrResult?.address ?? null,
        network: netResult?.network ?? null,
        isConnected: !!addrResult?.address,
        isLoading: false,
        error: null,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to connect wallet",
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState((s) => ({
      ...s,
      address: null,
      network: null,
      isConnected: false,
      isLoading: false,
      error: null,
      balances: [],
      totalUsdValue: 0,
    }));
  }, []);

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect, fetchBalances }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

