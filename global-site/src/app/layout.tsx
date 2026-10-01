import type { Metadata } from "next";
import "./globals.css";

const SITE = "https://shiftless.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Shiftless — Customer Support Headcount & Automation ROI Calculator",
    template: "%s | Shiftless",
  },
  description:
    "Free calculator: how many support agents do you actually need, and what would AI automation save you? No signup, instant result, based on your own ticket volume.",
  keywords: [
    "customer support headcount calculator",
    "support agent calculator",
    "help desk staffing calculator",
    "customer service automation ROI",
    "ecommerce support cost calculator",
    "tickets per agent",
  ],
  // Verified against the served HTML: og:url was missing entirely. A share card
  // without og:url lets every platform guess the canonical URL, and the guess is
  // frequently the tracking-parameter variant, which splits link equity.
  openGraph: {
    type: "website",
    siteName: "Shiftless",
    url: SITE,
    locale: "en_US",
    title: "Shiftless — Support Headcount & Automation ROI Calculator",
    description:
      "How many support agents do you need? Free, no signup, instant answer.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shiftless — Support Headcount & Automation ROI Calculator",
    description:
      "How many support agents do you need? Free, no signup, instant answer.",
  },
  // hreflang lives on the individual pages that declare alternates, not here:
  // declaring a zh-CN alternate at the root layout would attach it to /geo and
  // /embed too, advertising two relationships to pages that should not have
  // them. Each indexable page declares only its own.
  alternates: {
    canonical: SITE,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
