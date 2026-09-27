import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://rulex-alpha.vercel.app"),
  title: "RuleX | Transparent milestone escrow prototype",
  description: "RuleX is a university milestone-escrow prototype on Ethereum Sepolia. Test tokens only. Wallet actions are confirmed in MetaMask and RuleX never asks for seed phrases or private keys.",
  applicationName: "RuleX",
  keywords: ["RuleX", "milestone escrow", "Ethereum Sepolia", "freelancer escrow", "university prototype"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
