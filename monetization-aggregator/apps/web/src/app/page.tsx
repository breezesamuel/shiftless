'use client';

import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { ProductMatrix } from '@/components/ProductMatrix';
import { ReferralProgram } from '@/components/ReferralProgram';
import { WalletSection } from '@/components/WalletSection';
import { Footer } from '@/components/Footer';
import { SEOScript } from '@/components/SEOScript';

export default function HomePage() {
  return (
    <>
      <SEOScript />
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Hero />
          <ProductMatrix />
          <ReferralProgram />
          <WalletSection />
        </main>
        <Footer />
      </div>
    </>
  );
}