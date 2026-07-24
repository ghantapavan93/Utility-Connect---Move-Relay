import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Move Relay — Verified handoff infrastructure",
  description:
    "A provenance-aware canonical Move Record. Every handoff visible, attributable, reversible and verifiable.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        {children}
        {/* Provider responses and reconciliation settle asynchronously; they need
            to surface without stealing focus from whatever the operator is doing. */}
        <Toaster theme="dark" position="bottom-right" closeButton />
      </body>
    </html>
  );
}
