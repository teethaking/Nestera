import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Goal-Based Savings - Nestera",
  description: "Create and manage your goal-based savings. Set targets, automate contributions, and watch your savings grow with Nestera's secure smart contract technology.",
};

export default function SavingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
