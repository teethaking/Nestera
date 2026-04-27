import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - Nestera",
  description: "Review the terms and conditions for using Nestera's decentralized savings platform and smart contract services.",
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
