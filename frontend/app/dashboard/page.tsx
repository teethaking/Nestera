import React from "react";
import NetWorthCard from "../components/dashboard/NetWorthCard";
import QuickActionsGrid from "../components/dashboard/QuickActionsGrid";
import WalletBalanceCard from "../components/dashboard/WalletBalanceCard";
import ActivePoolList from "../components/dashboard/ActivePoolList";
import RecentTransactionsWidget from "../components/dashboard/RecentTransactionsWidget";

export default function DashboardPage() {
  return (
    <div className="w-full max-w-full overflow-x-hidden pb-10">
      {/* Top row: NetWorth (stretches) + QuickActions (fixed width) */}
      <div className="flex gap-4 md:gap-[18px] items-start flex-col md:flex-row">
        <div className="flex-1 w-full min-w-0">
          <NetWorthCard />
          <div className="mt-4 md:mt-[18px]">
            <ActivePoolList />
          </div>
        </div>
        <div className="w-full md:w-[360px] md:max-w-[40%] min-w-0 flex flex-col gap-4 md:gap-[18px]">
          <QuickActionsGrid />
          <WalletBalanceCard />
        </div>
      </div>

      {/* Second row: RecentTransactions */}
      <div className="mt-4 md:mt-5">
        <RecentTransactionsWidget />
      </div>
    </div>
  );
}

