'use client';

import { useEffect } from 'react';

export function SEOScript() {
  useEffect(() => {
    // JSON-LD structured data for the platform
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'BoostAI Monetization Platform',
      url: 'https://app.highkingflower.com',
      description: 'Unified monetization platform: Tools subscription, x402 pay-per-use APIs, AI skill licenses, tiered referral commissions.',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      publisher: {
        '@type': 'Organization',
        name: 'BoostAI',
        url: 'https://github.com/breezesamuel',
        logo: 'https://app.highkingflower.com/logo.png',
      },
      featureList: [
        '880+ online tools subscription',
        'x402 pay-per-use API ($0.10 USDC/call)',
        'AI agent skill licenses ($19-39)',
        'Tiered referral program (10-50% + bonuses)',
        'x402 Bazaar auto-discovery',
        'Base mainnet USDC settlements',
      ],
      screenshot: 'https://app.highkingflower.com/og-image.png',
      datePublished: '2024-01-01',
      dateModified: new Date().toISOString().split('T')[0],
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);

    // x402 payment required meta tag for Bazaar discovery
    const x402Meta = document.createElement('meta');
    x402Meta.name = 'x402-payment';
    x402Meta.content = 'true';
    document.head.appendChild(x402Meta);

    const facilitatorMeta = document.createElement('meta');
    facilitatorMeta.name = 'x402-facilitator';
    facilitatorMeta.content = 'https://facilitator.goplausible.xyz';
    document.head.appendChild(facilitatorMeta);

    return () => {
      document.head.removeChild(script);
      document.head.removeChild(x402Meta);
      document.head.removeChild(facilitatorMeta);
    };
  }, []);

  return null;
}