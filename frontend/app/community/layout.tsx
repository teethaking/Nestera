import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community - Nestera",
  description: "Connect with the Nestera community. Share savings tips, participate in discussions, and grow together in the decentralized financial ecosystem.",
};

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
