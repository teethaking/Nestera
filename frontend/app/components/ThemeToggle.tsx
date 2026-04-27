"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { type Theme, useTheme } from "../context/ThemeContext";

const themeOptions: Array<{
  value: Theme;
  label: string;
  description: string;
  Icon: typeof Sun;
}> = [
  {
    value: "light",
    label: "Light",
    description: "Bright interface for daytime use",
    Icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Low-glare theme for focused sessions",
    Icon: Moon,
  },
  {
    value: "system",
    label: "System",
    description: "Match your device appearance",
    Icon: Monitor,
  },
];

interface ThemeToggleProps {
  compact?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export default function ThemeToggle({
  compact = false,
  fullWidth = false,
  className,
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const activeOption = useMemo(
    () => themeOptions.find((option) => option.value === theme) ?? themeOptions[2],
    [theme]
  );

  const ActiveIcon = activeOption.Icon;
  const resolvedLabel = resolvedTheme === "dark" ? "Dark" : "Light";

  return (
    <div ref={containerRef} className={clsx("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={`Theme: ${activeOption.label}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={clsx(
          "inline-flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-strong)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]",
          compact
            ? "h-10 w-10 justify-center"
            : "gap-2 px-3.5 py-2.5 text-sm font-medium",
          fullWidth && "w-full justify-between"
        )}
      >
        <span className="inline-flex items-center justify-center">
          <ActiveIcon size={16} className="text-[var(--color-accent)]" />
        </span>
        {!compact ? (
          <>
            <span className="text-left">
              <span className="block leading-none">{activeOption.label}</span>
              <span className="mt-0.5 block text-xs text-[var(--color-text-muted)] leading-none">
                {theme === "system" ? `Following ${resolvedLabel}` : `Using ${resolvedLabel}`}
              </span>
            </span>
            <ChevronDown size={16} className="ml-auto text-[var(--color-text-muted)]" />
          </>
        ) : null}
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Theme selector"
          className={clsx(
            "absolute z-50 mt-2 min-w-[220px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-1.5 shadow-xl",
            compact ? "right-0" : "left-0"
          )}
        >
          {themeOptions.map(({ value, label, description, Icon }) => {
            const selected = theme === value;

            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setTheme(value);
                  setIsOpen(false);
                }}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset",
                  selected
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-text)]"
                    : "text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]"
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)]">
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-none">{label}</span>
                  <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                    {description}
                  </span>
                </span>
                {selected ? <Check size={16} className="text-[var(--color-accent)]" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
