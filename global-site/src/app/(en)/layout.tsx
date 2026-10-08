import type { Metadata } from "next";
import "../globals.css";

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

export default function EnLayout({
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
