import "./globals.css";

import type { Metadata } from "next";
import { ThemeProvider } from "./context/ThemeContext";
import { WalletProvider } from "./context/WalletContext";

const BASE_URL = "https://nestera.app";

const themeBootScript = `(function(){try{var key='nestera-theme';var root=document.documentElement;var stored=window.localStorage.getItem(key);var theme=stored==='light'||stored==='dark'||stored==='system'?stored:'system';var resolved=theme==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':theme==='system'?'light':theme;root.dataset.themePreference=theme;root.dataset.theme=resolved;root.classList.remove('light','dark');root.classList.add(resolved);root.style.colorScheme=resolved;}catch(error){document.documentElement.dataset.themePreference='system';}})();`;

export const metadata: Metadata = {
  title: "Nestera - Decentralized Savings on Stellar",
  description: "Secure, transparent savings powered by Stellar & Soroban",
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nestera - Decentralized Savings on Stellar",
    description: "Secure, transparent savings powered by Stellar & Soroban",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="bg-[var(--color-background)] text-[var(--color-text)] antialiased">
        <ThemeProvider>
          <WalletProvider>{children}</WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
