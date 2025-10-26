import type React from "react";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { WalletProvider } from "@/contexts/WalletContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Atlas",
  description:
    "AI-powered portfolio intelligence for Hedera network investments.",
  generator: "Atlas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-mono antialiased">
        <WalletProvider>
          <Suspense fallback={null}>{children}</Suspense>
        </WalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
