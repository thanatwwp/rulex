import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RuleX | Milestone escrow on Sepolia",
  description: "Create a freelance agreement, lock test tokens in escrow, and release milestone payments with MetaMask on Ethereum Sepolia.",
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
