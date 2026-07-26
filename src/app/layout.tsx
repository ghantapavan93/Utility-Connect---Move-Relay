import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { AccessibilityMenu } from "@/components/AccessibilityMenu";
import "./globals.css";

// Open Sans is Utility Connect's own body typeface. Using it makes the clone read
// as theirs at a glance, before a single color is applied.
const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-open-sans",
});

export const metadata: Metadata = {
  title: "Move Relay — Verified handoff infrastructure",
  description:
    "A provenance-aware canonical Move Record. Every handoff visible, attributable, reversible and verifiable.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={openSans.variable}>
      <body className="min-h-dvh antialiased">
        {children}
        {/* Every route, not just the marketing pages. An accessibility control
            that is only present where someone thought to add it is not one. */}
        <AccessibilityMenu />
        {/* Provider responses and reconciliation settle asynchronously; they need
            to surface without stealing focus from whatever the operator is doing. */}
        <Toaster theme="dark" position="bottom-right" closeButton />
      </body>
    </html>
  );
}
