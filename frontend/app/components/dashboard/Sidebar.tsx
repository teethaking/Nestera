"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Briefcase,
  Copy,
  History,
  Home,
  Landmark,
  LayoutGrid,
  LifeBuoy,
  Menu,
  PieChart,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserCircle,
  Users,
  X,
} from "lucide-react";

const navLinks = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Savings Pools", href: "/dashboard/savings-pools", icon: Landmark },
  { label: "Staking", href: "/dashboard/staking", icon: TrendingUp },
  { label: "Analytics", href: "/dashboard/analytics", icon: PieChart },
  { label: "Portfolio", href: "/dashboard/portfolio", icon: Briefcase },
  { label: "Governance", href: "/dashboard/governance", icon: ShieldCheck },
  { label: "Transactions", href: "/dashboard/transactions", icon: History },
  { label: "Referrals", href: "/dashboard/referrals", icon: Users },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { label: "Profile", href: "/dashboard/profile", icon: UserCircle },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Support", href: "/support", icon: LifeBuoy },
];

const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-[var(--color-overlay)] md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        aria-label="Sidebar"
        style={{ width: 200, minWidth: 180 }}
        className={[
          "fixed left-0 top-0 z-50 h-screen",
          "flex flex-col border-r border-[var(--color-border)]",
          "bg-[var(--color-sidebar)] text-[var(--color-text)]",
          "transition-transform duration-250 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-4 pt-5 pb-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 text-inherit no-underline">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <LayoutGrid size={18} />
            </div>
            <span className="text-[15px] font-bold text-[var(--color-text)]">Nestera</span>
          </Link>

          <button
            className="cursor-pointer border-0 bg-transparent text-[var(--color-text-muted)] md:hidden"
            onClick={() => setOpen((current) => !current)}
            aria-label="Toggle menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="flex flex-1 flex-col overflow-y-auto px-2" style={{ gap: 4 }}>
          {navLinks.map((link) => {
            const Icon = link.icon as React.ElementType;
            const active = isActive(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                style={{ padding: "11px 12px", fontSize: 14 }}
                className={[
                  "relative flex items-center rounded-xl font-medium no-underline",
                  active
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]",
                ].join(" ")}
              >
                {active ? (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full bg-[var(--color-accent)]"
                    style={{ width: 3, height: "55%" }}
                  />
                ) : null}
                <span
                  className="flex shrink-0 items-center justify-center"
                  style={{ marginLeft: 8, marginRight: 12 }}
                >
                  <Icon size={17} />
                </span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4">
          <div
            className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
            style={{ padding: "10px 12px" }}
          >
            <div className="relative shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-xs font-bold text-[var(--color-accent)]">
                0x
              </div>
              <span className="absolute right-0 bottom-0 h-2 w-2 rounded-full border-2 border-[var(--color-sidebar)] bg-[var(--color-success)]" />
            </div>
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-soft)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                Connected
              </div>
              <div className="truncate text-[12px] font-semibold text-[var(--color-text)]">
                0x4a...8f
              </div>
              <div className="text-[10px] text-[var(--color-text-soft)]">Stellar Network</div>
            </div>
            <button
              className="ml-auto shrink-0 cursor-pointer rounded p-1 text-[var(--color-text-soft)] hover:text-[var(--color-accent)]"
              aria-label="Copy address"
            >
              <Copy size={12} />
            </button>
          </div>
        </div>
      </aside>

      <button
        className="fixed top-5 left-4 z-[60] flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] md:hidden"
        onClick={() => setOpen((current) => !current)}
        aria-label="Toggle menu"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
    </>
  );
};

export default Sidebar;
