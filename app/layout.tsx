import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WalletBrief — Monad wallet clarity",
  description:
    "Check any Monad wallet, see active token approvals, and simulate owner-signed revokes.",
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
