"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Wallet } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { useWallet } from "../context/WalletContext";

interface NavLink {
  label: string;
  href: string;
}

const navLinks: NavLink[] = [
  { label: "Features", href: "/features" },
  { label: "Savings", href: "/savings" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Community", href: "/community" },
  { label: "Docs", href: "/docs" },
];

const navLinkBase =
  "border-b-2 border-transparent pb-0.5 text-sm font-medium text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)]";
const navLinkActive =
  "border-b-[var(--color-accent)] text-[var(--color-accent)]";
const mobileLinkBase =
  "block rounded-xl border-l-4 border-transparent px-3 py-3 text-base font-medium text-[var(--color-text-muted)] no-underline hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]";
const mobileLinkActive =
  "border-l-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]";

const Navbar: React.FC = () => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { address, network, isConnected, isLoading, error, connect } = useWallet();

  const isActiveLink = (href: string): boolean => {
    return pathname === href || pathname?.startsWith(href + "/") || false;
  };

  const shortAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : null;

  const WalletButton = ({ mobile = false }: { mobile?: boolean }) => {
    if (isConnected && address) {
      return (
        <div
          className={`flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)] ${mobile ? "mt-4 w-full justify-center" : ""}`}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          <span>{shortAddress}</span>
          {network ? (
            <span className="text-xs font-normal text-[var(--color-text-muted)]">
              {network}
            </span>
          ) : null}
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={connect}
        disabled={isLoading}
        title={error ?? undefined}
        className={`inline-flex items-center justify-center gap-2 rounded-full border-none bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#061a1a] shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100 ${mobile ? "mt-4 w-full" : "hidden sm:inline-flex"}`}
      >
        {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
        {isLoading ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-nav)]/95 backdrop-blur-xl">
      <div className="w-full">
        <div className="flex h-16 items-center justify-between px-[30px]">
          <div className="shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2 no-underline transition-transform duration-200 hover:scale-[1.02]"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] p-0 text-lg font-bold text-[#061a1a]">
                <Wallet size={18} color="#061a1a" strokeWidth={2} />
              </div>
              <span className="max-sm:hidden text-xl font-bold text-[var(--color-text)]">
                Nestera
              </span>
            </Link>
          </div>

          <div className="hidden flex-1 items-center justify-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={isActiveLink(link.href) ? `${navLinkBase} ${navLinkActive}` : navLinkBase}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle compact className="hidden md:flex" />
            <WalletButton />

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] md:hidden"
              aria-expanded={isMobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <svg
                  className="h-6 w-6 fill-none stroke-current stroke-2"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6 fill-none stroke-current stroke-2"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`border-t border-[var(--color-border)] bg-[var(--color-nav)] shadow-lg md:hidden ${isMobileMenuOpen ? "block" : "hidden"}`}
      >
        <div className="flex flex-col gap-2 p-3 pb-4">
          <ThemeToggle fullWidth />
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={isActiveLink(link.href) ? `${mobileLinkBase} ${mobileLinkActive}` : mobileLinkBase}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <WalletButton mobile />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
