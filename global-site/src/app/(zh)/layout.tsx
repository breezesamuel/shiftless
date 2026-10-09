import type { Metadata } from "next";
import "../globals.css";
import { SITE_URL as SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Shiftless — 客服人力成本与 AI 自动化 ROI 计算器",
    template: "%s | Shiftless",
  },
  description:
    "免费计算器：你到底需要多少客服？AI 自动化能省多少？无需注册，基于真实工单量即算即得。",
  openGraph: {
    type: "website",
    siteName: "Shiftless",
    url: SITE,
    locale: "zh_CN",
    title: "Shiftless — 客服人力成本与 AI 自动化 ROI 计算器",
    description:
      "你需要多少客服？免费、无需注册、即算即得。",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shiftless — 客服人力成本与 AI 自动化 ROI 计算器",
    description:
      "你需要多少客服？免费、无需注册、即算即得。",
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

export default function ZhLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
