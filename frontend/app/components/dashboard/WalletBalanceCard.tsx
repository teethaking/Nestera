"use client";

import React from "react";
import { useWallet } from "../../context/WalletContext";
import { Wallet, TrendingUp, ArrowUpRight } from "lucide-react";

const WalletBalanceCard: React.FC = () => {
  const { balances, isConnected, isLoading } = useWallet();

  if (!isConnected) {
    return (
      <div className="bg-[#0e2330] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <Wallet size={48} className="text-[#3a5a6a] mb-4" />
        <p className="text-[#6a9fae] text-center">Connect your wallet to view your balances</p>
      </div>
    );
  }

  if (isLoading && balances.length === 0) {
    return (
      <div className="bg-[#0e2330] border border-white/5 rounded-2xl p-6 animate-pulse min-h-[300px]">
        <div className="h-6 w-32 bg-white/5 rounded mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0e2330] border border-white/5 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#08c1c1]/10 flex items-center justify-center text-[#08c1c1]">
            <Wallet size={20} />
          </div>
          <h3 className="text-white font-bold text-lg m-0">Wallet Assets</h3>
        </div>
        <button className="text-[#08c1c1] text-xs font-semibold hover:underline flex items-center gap-1 transition-all">
          Manage Assets <ArrowUpRight size={14} />
        </button>
      </div>

      <div className="space-y-3">
        {balances.length === 0 ? (
          <p className="text-[#6a9fae] text-sm py-4">No assets found in this wallet.</p>
        ) : (
          balances.map((asset) => (
            <div
              key={`${asset.asset_code}-${asset.asset_issuer || "native"}`}
              className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1e2f3a] flex items-center justify-center font-bold text-xs text-[#08c1c1] border border-white/5">
                  {asset.asset_code.substring(0, 4)}
                </div>
                <div>
                  <div className="text-white font-semibold">{asset.asset_code}</div>
                  <div className="text-[#6a9fae] text-xs">
                    {asset.asset_type === "native" ? "Native Asset" : "Token"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold">
                  {parseFloat(asset.balance).toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </div>
                <div className="text-[#08c1c1] text-xs font-medium">
                  ${asset.usd_value.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 pt-5 border-t border-white/5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6a9fae]">Total Wallet Value</span>
          <span className="text-white font-bold">
            ${balances.reduce((acc, curr) => acc + curr.usd_value, 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default WalletBalanceCard;
