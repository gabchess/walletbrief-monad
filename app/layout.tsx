import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WalletBrief",
  description:
    "Persistent Monad mainnet wallet briefing + one-click batch-revoke agent.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
