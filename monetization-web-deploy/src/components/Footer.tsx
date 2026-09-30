'use client';

import Link from 'next/link';
import { Github, Twitter, MessageCircle, Mail, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const footerLinks = {
  product: [
    { label: 'Toolbox', href: 'https://app.highkingflower.com' },
    { label: 'AI 数字员工 ROI 测算', href: '/roi' },
    { label: '客服 ROI 测算', href: '/cs' },
    { label: '价格与方案', href: '/pricing' },
    { label: '提交采购订单', href: '/order' },
    { label: 'x402 API', href: 'https://x402.highkingflower.com/pay/today' },
    { label: 'Skills', href: 'https://github.com/breezesamuel?tab=repositories&q=skill' },
    { label: 'Paywall Template', href: 'https://github.com/breezesamuel/x402-paywall' },
  ],
  developers: [
    { label: 'API Docs', href: '/docs' },
    { label: 'x402 Spec', href: 'https://docs.x402.org' },
    { label: 'MCP Servers', href: 'https://github.com/breezesamuel?tab=repositories&q=mcp' },
    { label: 'SDKs', href: '/developers/sdks' },
    { label: 'Live x402 API', href: 'https://x402.highkingflower.com/pay/today' },
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Press', href: '/press' },
    { label: 'Contact', href: 'mailto:hello@highkingflower.com' },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Cookie Policy', href: '/cookies' },
    { label: 'Security', href: '/security' },
    { label: 'Licenses', href: '/licenses' },
  ],
};

const socialLinks = [
  { icon: Github, href: 'https://github.com/breezesamuel', label: 'GitHub' },
  { icon: Twitter, href: 'https://twitter.com/breezesamuel', label: 'Twitter' },
  { icon: MessageCircle, href: 'https://discord.gg/boostai', label: 'Discord' },
  { icon: Mail, href: 'mailto:hello@highkingflower.com', label: 'Email' },
];

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4" aria-label="BoostAI Home">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-accent-500">
                <span className="text-white font-bold text-xl">B</span>
              </div>
              <span className="font-bold text-xl text-gray-900 dark:text-white">
                Boost<span className="text-primary-500">AI</span>
              </span>
            </Link>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 max-w-xs">
              Unified monetization platform for developers, creators, and AI agents.
              Tools, APIs, Skills & Referrals — all in one place.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="h-5 w-5" />
                  <ExternalLink className="sr-only" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Products</h4>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Developers</h4>
            <ul className="space-y-2">
              {footerLinks.developers.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Company</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} BoostAI. Built to earn, fully transparent.
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <span>Open Source</span>
              <a href="https://github.com/breezesamuel" target="_blank" rel="noopener noreferrer" className="hover:text-primary-500 transition-colors">
                MIT License
              </a>
              <a href="/audit" className="hover:text-primary-500 transition-colors">
                Audit Report
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}