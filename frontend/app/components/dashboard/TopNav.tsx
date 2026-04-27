"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  Copy,
  ExternalLink,
  HelpCircle,
  LogOut,
  Search,
  Wallet,
} from "lucide-react";
import ThemeToggle from "../ThemeToggle";
import { useWallet } from "../../context/WalletContext";
import NetworkIndicator from "./NetworkIndicator";

const actionButtons = [
  { Icon: Search, label: "Search" },
  { Icon: Bell, label: "Notifications" },
  { Icon: HelpCircle, label: "Help" },
];

const actionButtonClass =
  "flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]";

const TopNav: React.FC = () => {
  const { address, network, isConnected, disconnect, balances } = useWallet();
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const xlmBalance = balances.find((balance) => balance.asset_code === "XLM")?.balance || "0";
  const formattedXlm = parseFloat(xlmBalance).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copyToClipboard = () => {
    if (!address) {
      return;
    }

    navigator.clipboard.writeText(address);
    setCopied(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const getExplorerLink = (addr: string, net: string | null) => {
    const networkParam = net?.toLowerCase() === "public" ? "public" : "testnet";
    return `https://stellar.expert/explorer/${networkParam}/account/${addr}`;
  };

  const shortAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : null;

  const handleDisconnect = () => {
    disconnect();
    setShowConfirm(false);
    router.push("/");
  };

  const normalizedNetwork = network?.toUpperCase();
  const isTestnet =
    normalizedNetwork === "TESTNET" ||
    normalizedNetwork === "FUTURENET" ||
    normalizedNetwork === "STANDALONE";

  return (
    <>
      {isConnected && isTestnet ? (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 animate-pulse bg-amber-500/50" />
      ) : null}

      <header
        className={`sticky top-0 right-0 z-40 flex items-center justify-between border-b bg-[var(--color-background)]/72 px-0 backdrop-blur-sm md:px-6 ${
          isTestnet ? "border-amber-500/20" : "border-[var(--color-border)]"
        }`}
        style={{ height: 64 }}
      >
        <div className="hidden flex-col gap-0.5 sm:flex">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-[22px] leading-none font-bold text-[var(--color-text)]">
              Welcome back, Alex
            </h2>
            {isConnected && isTestnet ? (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
                Testnet Mode
              </span>
            ) : null}
          </div>
          <p className="m-0 text-[13px] text-[var(--color-text-soft)]">
            Here&apos;s your financial overview
          </p>
        </div>

        <div className="ml-auto flex items-center gap-[10px]">
          <div className="mr-2 flex items-center gap-2">
            <ThemeToggle compact />
            <div className="hidden items-center gap-2 lg:flex">
              {actionButtons.map(({ Icon, label }) => (
                <button key={label} aria-label={label} className={actionButtonClass}>
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>

          {isConnected && address && shortAddress ? (
            <div className="flex items-center gap-2">
              <div className="flex h-[38px] items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3">
                <div className="flex items-center gap-1.5 border-r border-[var(--color-border)] pr-2">
                  <span className="text-xs font-bold text-[var(--color-accent)]">
                    {formattedXlm} XLM
                  </span>
                </div>

                <div className="flex items-center gap-1.5 cursor-help" title={address}>
                  <Wallet size={14} className="text-[var(--color-text-muted)]" />
                  <span className="font-mono text-xs font-semibold text-[var(--color-text)]">
                    {shortAddress}
                  </span>
                </div>

                <div className="flex items-center gap-1 pl-1">
                  <button
                    onClick={copyToClipboard}
                    className="cursor-pointer rounded-md p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
                    title="Copy full address"
                    aria-label="Copy wallet address"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  <a
                    href={getExplorerLink(address, network)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
                    title="View on Stellar Expert"
                    aria-label="View on Stellar Expert"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              <NetworkIndicator network={network} isConnected={isConnected} />

              <button
                aria-label="Disconnect wallet"
                onClick={() => setShowConfirm(true)}
                className={`${actionButtonClass} hover:text-[var(--color-danger)]`}
                title="Disconnect wallet"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : null}

          <div
            className="flex h-[38px] w-[38px] select-none items-center justify-center rounded-full bg-linear-to-b from-[var(--color-accent)] to-[var(--color-accent-strong)] text-[15px] font-bold text-[#021515]"
            style={{ marginLeft: 4 }}
          >
            A
          </div>
        </div>
      </header>

      {showConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disconnect-title"
        >
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <LogOut size={18} className="text-[var(--color-danger)]" />
              </div>
              <h3 id="disconnect-title" className="m-0 text-base font-semibold text-[var(--color-text)]">
                Disconnect Wallet
              </h3>
            </div>
            <p className="mb-5 text-sm text-[var(--color-text-muted)]">
              Are you sure you want to disconnect {" "}
              <span className="font-mono text-[var(--color-accent)]">{shortAddress}</span>?
              You will be redirected to the home page.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                className="flex-1 rounded-xl border border-red-500/30 bg-red-500/85 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default TopNav;
