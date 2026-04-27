import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support - Nestera",
  description: "Get help with Nestera. Find answers to common questions, view documentation, and contact our support team for assistance.",
};

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
