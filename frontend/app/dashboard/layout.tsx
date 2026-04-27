import React from "react";
import Sidebar from "../components/dashboard/Sidebar";
import TopNav from "../components/dashboard/TopNav";

export const metadata = {
  title: "Dashboard - Nestera",
  description:
    "Manage your Nestera portfolio, track your savings growth, and monitor your active goals in one unified dashboard.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="block min-h-screen overflow-x-hidden bg-[var(--color-background)]">
      <Sidebar />
      <div className="min-h-screen max-w-full px-4 py-5 md:ml-[180px] md:px-6">
        <TopNav />
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
