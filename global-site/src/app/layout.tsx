import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://shiftless.vercel.app"),
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
    title: "Shiftless — Support Headcount & Automation ROI Calculator",
    description:
      "How many support agents do you need? Free, no signup, instant answer.",
  },
  robots: { index: true, follow: true },
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
