'use client';

import { Gift, ArrowUpRight, Users, Percent, DollarSign, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const tiers = [
  { name: 'Bronze', minRefs: 0, rate: '10%', bonus: '$0', color: 'bg-amber-500', desc: 'Just started' },
  { name: 'Silver', minRefs: 5, rate: '15%', bonus: '$1/ref', color: 'bg-gray-400', desc: '5 referrals' },
  { name: 'Gold', minRefs: 20, rate: '20%', bonus: '$3/ref', color: 'bg-yellow-500', desc: '20 referrals' },
  { name: 'Platinum', minRefs: 100, rate: '30%', bonus: '$10/ref', color: 'bg-gray-300', desc: '100 referrals' },
  { name: 'Diamond', minRefs: 500, rate: '50%', bonus: '$50/ref', color: 'bg-blue-500', desc: '500 referrals' },
];

const steps = [
  { step: '1', title: 'Share Your Link', desc: 'Copy your unique referral link from the dashboard' },
  { step: '2', title: 'Friends Sign Up', desc: 'They get instant access, you get credited' },
  { step: '3', title: 'Earn Commissions', desc: 'Earn on every payment they make, forever' },
  { step: '4', title: 'Level Up', desc: 'Higher tiers = higher rates + bonuses' },
];

export function ReferralProgram() {
  return (
    <section id="referral" className="py-20 sm:py-28 lg:py-36 bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-primary-900/20 dark:via-gray-950 dark:to-accent-900/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Referral <span className="text-primary-500">Program</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            Industry-leading tiered commissions up to 50% + per-referral bonuses. The more you refer, the more you earn per referral.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {tiers.map((tier, i) => (
            <div
              key={tier.name}
              className={cn(
                'relative p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800',
                'transition-all hover:shadow-xl hover:border-primary-500/50'
              )}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-xl', tier.color)}>
                  {tier.name.charAt(0)}
                </div>
              </div>
              <div className="pt-8 text-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{tier.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tier.desc}</p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Commission</span>
                    <span className="font-bold text-gray-900 dark:text-white">{tier.rate}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Bonus/Ref</span>
                    <span className="font-bold text-success-600">{tier.bonus}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-gray-500">Min Referrals</span>
                    <span className="font-bold">{tier.minRefs}+</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-16">
          {steps.map((step, i) => (
            <div key={step.step} className="relative p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <div className="absolute -top-3 left-6">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-lg">
                  {step.step}
                </div>
              </div>
              <div className="pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{step.title}</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-primary-500 via-accent-500 to-success-500 rounded-3xl p-8 md:p-12 text-center text-white">
          <h3 className="text-3xl font-bold mb-4">Ready to Start Earning?</h3>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Join 1,000+ creators earning passive income. Your referral link is ready in the dashboard.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold bg-white text-primary-600 rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
          >
            Get My Link
            <TrendingUp className="h-5 w-5" />
          </a>
        </div>
      </div>
    </section>
  );
}