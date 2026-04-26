"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, HelpCircle, LogOut, Wallet, Copy, ExternalLink, Check } from "lucide-react";
import { useWallet } from "../../context/WalletContext";
import NetworkIndicator from "./NetworkIndicator";

const TopNav: React.FC = () => {
  const { address, network, isConnected, disconnect, balances } = useWallet();
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const xlmBalance = balances.find(b => b.asset_code === "XLM")?.balance || "0";
  const formattedXlm = parseFloat(xlmBalance).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

  const copyToClipboard = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getExplorerLink = (addr: string, net: string | null) => {
    const networkParam = net?.toLowerCase() === "public" ? "public" : "testnet";
    return `https://stellar.expert/explorer/${networkParam}/account/${addr}`;
  };

  const shortAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : null;

  function handleDisconnect() {
    disconnect();
    setShowConfirm(false);
    router.push("/");
  }

  return (
    <>
      <header
        className="sticky top-0 right-0 flex items-center justify-between bg-transparent z-40 backdrop-blur-sm px-0 md:px-6"
        style={{ height: 64 }}
      >
        {/* Left: heading + subtitle */}
        <div className="hidden sm:flex flex-col gap-0.5">
          <h2
            className="m-0 text-white font-bold leading-none"
            style={{ fontSize: 22 }}
          >
            Welcome back, Alex
          </h2>
          <p className="m-0 text-[#4e8a96]" style={{ fontSize: 13 }}>
            Here&apos;s your financial overview
          </p>
        </div>

        {/* Right: icons + wallet + avatar */}
        <div className="flex items-center ml-auto" style={{ gap: 10 }}>
          {[
            { Icon: Search, label: "Search" },
            { Icon: Bell, label: "Notifications" },
            { Icon: HelpCircle, label: "Help" },
          ].map(({ Icon, label }) => (
            <button
              key={label}
              aria-label={label}
              className="flex items-center justify-center text-[#6a9fae] cursor-pointer hover:text-white transition-colors bg-[#0e2330] border border-white/8 rounded-xl"
              style={{ width: 38, height: 38 }}
            >
              <Icon size={16} />
            </button>
          ))}

          {/* Wallet info + disconnect */}
          {isConnected && address && shortAddress ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#0e2330] border border-white/8 rounded-xl h-[38px] px-3 gap-3">
                <div className="flex items-center gap-1.5 border-r border-white/10 pr-2">
                  <span className="text-[#00c9c8] text-xs font-bold font-mono">
                    {formattedXlm} XLM
                  </span>
                </div>
                
                <div 
                  className="flex items-center gap-1.5 cursor-help" 
                  title={address}
                >
                  <Wallet size={14} className="text-[#6a9fae]" />
                  <span className="text-white text-xs font-semibold font-mono">
                    {shortAddress}
                  </span>
                </div>

                
                <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
                  <button
                    onClick={copyToClipboard}
                    className="text-slate-400 hover:text-[#00c9c8] transition-colors cursor-pointer p-1"
                    title="Copy full address"
                    aria-label="Copy wallet address"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  <a
                    href={getExplorerLink(address, network)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-[#00c9c8] transition-colors p-1"
                    title="View on Stellar Expert"
                    aria-label="View on Stellar Expert"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {/* Network Indicator */}
              <NetworkIndicator 
                network={network} 
                isConnected={isConnected} 
              />

              <button
                aria-label="Disconnect wallet"
                onClick={() => setShowConfirm(true)}
                className="flex items-center justify-center text-slate-400 cursor-pointer hover:text-red-400 transition-colors bg-[#0e2330] border border-white/8 rounded-xl"
                style={{ width: 38, height: 38 }}
                title="Disconnect wallet"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : null}

          {/* Avatar */}
          <div
            className="rounded-full bg-linear-to-b from-[#08c1c1] to-[#0fa3a3] flex items-center justify-center font-bold text-[#021515] select-none"
            style={{ width: 38, height: 38, fontSize: 15, marginLeft: 4 }}
          >
            A
          </div>
        </div>
      </header>

      {/* Disconnect confirmation modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disconnect-title"
        >
          <div className="bg-[#0e2330] border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <LogOut size={18} className="text-red-400" />
              </div>
              <h3
                id="disconnect-title"
                className="text-white font-semibold text-base m-0"
              >
                Disconnect Wallet
              </h3>
            </div>
            <p className="text-slate-400 text-sm mb-5">
              Are you sure you want to disconnect{" "}
              <span className="text-[#00c9c8] font-mono">{shortAddress}</span>?
              You will be redirected to the home page.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-medium hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                className="flex-1 py-2.5 rounded-xl bg-red-500/80 border border-red-500/40 text-white text-sm font-semibold hover:bg-red-500 transition-colors cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopNav;
