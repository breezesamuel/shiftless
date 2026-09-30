import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const SITE = 'https://web-solmount.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'BoostAI · AI 数字员工（按席位订阅 + 私有化部署）',
    template: '%s · BoostAI',
  },
  description:
    'AI 数字员工按席位订阅：销售、客服、运营、财务、招聘。公开价目表，ROI 在线测算，先做 4 周概念验证（POC），不达标退一半。',
  keywords: [
    'AI数字员工',
    'AI客服',
    'AI客服价格',
    '客服ROI测算',
    '私有化部署',
    'AI员工订阅',
    'POC',
  ],
  alternates: { canonical: '/' },
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: SITE,
    siteName: 'BoostAI',
    title: 'BoostAI · AI 数字员工（按席位订阅 + 私有化部署）',
    description:
      '按席位订阅的 AI 数字员工：销售 / 客服 / 运营 / 财务 / 招聘。公开价目表，ROI 在线测算，4 周 POC 不达标退一半。',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BoostAI · AI 数字员工',
    description: '按席位订阅的 AI 数字员工，公开价目表，ROI 在线测算。',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {children}
      </body>
    </html>
  );
}
