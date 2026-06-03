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
  title: "Digital Asset Investigations - Crypto Scam Recovery & Secure Escrow",
  description:
    "Digital Asset Investigations helps clients file crypto scam recovery complaints, complete KYC, track recovered funds in escrow, and request admin-approved withdrawals.",
  applicationName: "Digital Asset Investigations",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  openGraph: {
    title: "Digital Asset Investigations - Crypto Scam Recovery & Secure Escrow",
    description:
      "Open recovery complaints, upload evidence, complete KYC, and track recovered funds in admin-controlled escrow.",
    type: "website",
    siteName: "Digital Asset Investigations",
  },
  twitter: {
    card: "summary_large_image",
    title: "Digital Asset Investigations - Crypto Scam Recovery & Secure Escrow",
    description:
      "Open recovery complaints, upload evidence, complete KYC, and track recovered funds in admin-controlled escrow.",
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
  // Ship DARK by default. The brand name "Digital Asset Investigations" is a placeholder — change it in
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
