'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle, Zap, Shield, Users, Globe, Code2, Wallet, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const stats = [
  { value: '880+', label: 'Tools Integrated' },
  { value: '$0.10', label: 'Per API Call (x402)' },
  { value: '$19-39', label: 'Per Skill License' },
  { value: '70%', label: 'Max Referral Commission' },
];

const features = [
  { icon: Zap, title: 'Instant Payments', desc: 'x402 + Base USDC, settle in seconds' },
  { icon: Shield, title: 'Secure by Default', desc: 'Web3 wallets + Alipay, no KYC for API' },
  { icon: Globe, title: 'Global Reach', desc: 'Borderless monetization for creators worldwide' },
  { icon: Code2, title: 'Developer First', desc: 'SDKs, MCP servers, one-line integration' },
  { icon: Users, title: 'Community Driven', desc: 'Open source skills, transparent revenue' },
  { icon: BarChart3, title: 'Real-time Analytics', desc: 'Track revenue, referrals, usage in real-time' },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-sm font-medium mb-6 animate-slide-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
            </span>
            Live on Base Mainnet · x402 Bazaar Enabled · vet402 Auto-Buy Ready
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            One Platform,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 via-accent-500 to-success-500">
              Four Ways to Earn
            </span>
          </h1>

          <p className="mx-auto max-w-3xl text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-10 animate-slide-up" style={{ animationDelay: '200ms' }}>
            Real products, real revenue. Tools subscription, pay-per-use x402 APIs, AI skill licenses, and tiered referral commissions.
            All live, all transparent, all yours.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up" style={{ animationDelay: '300ms' }}>
            <Link
              href="/dashboard"
              className="group flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl hover:from-primary-600 hover:to-accent-600 transition-all shadow-lg shadow-primary-500/25"
            >
              Start Earning Now
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="#matrix"
              className="flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              Explore Products
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 animate-fade-in" style={{ animationDelay: '400ms' }}>
            {stats.map((stat, i) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary-500 via-accent-500 to-success-500 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '600ms' }}>
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary-50/50 to-accent-50/50 dark:from-primary-900/20 dark:to-accent-900/20 border border-primary-100 dark:border-primary-900/30 text-center">
              <div className="text-2xl font-bold text-primary-500 mb-1">+5</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">New Aggregation Models</div>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-accent-50/50 to-success-50/50 dark:from-accent-900/20 dark:to-success-900/20 border border-accent-100 dark:border-accent-900/30 text-center">
              <div className="text-2xl font-bold text-accent-500 mb-1">200+</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Aggregated Services</div>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-success-50/50 to-primary-50/50 dark:from-success-900/20 dark:from-primary-900/20 border border-success-100 dark:border-success-900/30 text-center">
              <div className="text-2xl font-bold text-success-500 mb-1">98%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Avg Retention Rate</div>
            </div>
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '500ms' }}>
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all shadow-sm hover:shadow-xl"
              style={{ animationDelay: `${500 + i * 100}ms` }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500/10 to-accent-500/10 text-primary-500 group-hover:bg-gradient-to-br group-hover:from-primary-500 group-hover:to-accent-500 group-hover:text-white transition-all">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">{feature.title}</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}