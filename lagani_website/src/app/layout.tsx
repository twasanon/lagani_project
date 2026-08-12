import type { Metadata, Viewport } from "next";

import { getPublicSiteConfig } from "@/lib/site-config";

import "./globals.css";

const config = getPublicSiteConfig();

export const metadata: Metadata = {
  metadataBase: config.siteUrl,
  title: {
    default: "Lagani — NEPSE portfolio and paper trading",
    template: "%s | Lagani",
  },
  description:
    "Track NEPSE holdings, practice paper trading, follow companies, and review the latest available Nepal market data.",
  applicationName: "Lagani",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Lagani — Your NEPSE portfolio, in focus",
    description:
      "Portfolio tracking, paper trading, company watchlists, historical charts, and Nepal market news.",
    type: "website",
    url: "/",
    siteName: "Lagani",
  },
  twitter: {
    card: "summary",
    title: "Lagani — Your NEPSE portfolio, in focus",
    description: "NEPSE portfolio tracking and educational tools.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07100d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
