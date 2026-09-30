import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'BoostAI - Unified Monetization Platform',
  description: 'Tools, APIs, Skills & Affiliate - One platform, multiple revenue streams',
  keywords: ['monetization', 'x402', 'api', 'tools', 'skills', 'affiliate', 'subscription'],
  authors: [{ name: 'BoostAI Team' }],
  creator: 'BoostAI',
  publisher: 'BoostAI',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://app.highkingflower.com',
    title: 'BoostAI - Unified Monetization Platform',
    description: 'Tools, APIs, Skills & Affiliate - One platform, multiple revenue streams',
    siteName: 'BoostAI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BoostAI - Unified Monetization Platform',
    description: 'Tools, APIs, Skills & Affiliate - One platform, multiple revenue streams',
  },
  verification: {
    google: 'google-site-verification-code',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.highkingflower.com" />
        <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {children}
      </body>
    </html>
  );
}