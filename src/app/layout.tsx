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

/**
 * Metadata, written for the place this link actually gets opened.
 *
 * A URL sent to a hiring manager unfurls in a chat client before anyone visits
 * it, and the description is doing the work of a cover letter in two lines. So
 * it leads with the failure the project is built around rather than a summary
 * of features — every platform in this category claims to simplify a move, and
 * none of them claim to refuse a retry.
 *
 * `metadataBase` matters more than it looks: without it Next emits relative
 * OG image URLs, which most crawlers drop, and the card that took the trouble
 * to generate never appears. It reads from the deployment URL when there is
 * one and falls back to localhost so the preview is inspectable in dev.
 */
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  ),
  title: {
    default: "Move Relay — verified handoff infrastructure",
    template: "%s — Move Relay",
  },
  description:
    "One move arrives on three channels, no two agree, and the provider's reply is lost. The system holds UNKNOWN, refuses the blind retry, and reconciles. Real Postgres, 596 tests, no mocks.",
  applicationName: "Move Relay",
  authors: [{ name: "Pavan Kalyan Ghanta" }],
  keywords: [
    "provenance",
    "idempotency",
    "distributed systems",
    "reconciliation",
    "home services",
    "move-in",
  ],
  openGraph: {
    type: "website",
    siteName: "Move Relay",
    title: "The provider created the order. The reply never came.",
    description:
      "A provenance-aware Move Record where every value remembers who supplied it — and a provider timeout the system refuses to retry blindly.",
  },
  twitter: {
    card: "summary_large_image",
    title: "The provider created the order. The reply never came.",
    description:
      "UNKNOWN is a real state here. The blind retry is refused and reconciliation recovers the existing order. One order, never two.",
  },
  robots: { index: true, follow: true },
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
