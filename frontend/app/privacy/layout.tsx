import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Nestera",
  description: "Learn about how Nestera protects your privacy and handles your data with transparency and security on the Stellar blockchain.",
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
