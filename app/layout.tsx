import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AEGIS — Secure Escrow & Investigation Management",
  description:
    "AEGIS is a trust-heavy platform to open investigation projects, fund escrow, upload evidence, communicate securely, and release funds only after mutual approval or admin dispute resolution. Funds are processed only through licensed payment/escrow partners where available.",
  applicationName: "AEGIS",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  openGraph: {
    title: "AEGIS — Secure Escrow & Investigation Management",
    description:
      "Open cases, fund escrow, exchange evidence, and release funds only after mutual approval or admin dispute resolution.",
    type: "website",
    siteName: "AEGIS",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEGIS — Secure Escrow & Investigation Management",
    description:
      "Open cases, fund escrow, exchange evidence, and release funds only after mutual approval or admin dispute resolution.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Ship DARK by default. The brand name "AEGIS" is a placeholder — change it in
  // lib/constants.ts (APP_NAME) and components/shared/Logo.tsx.
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          "min-h-screen bg-background font-sans text-foreground antialiased"
        )}
      >
        {children}
        <Toaster richColors position="top-right" closeButton theme="dark" />
      </body>
    </html>
  );
}
