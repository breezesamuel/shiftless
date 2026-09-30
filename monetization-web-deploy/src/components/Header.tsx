'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Sun, Moon, Wallet, User, LogOut, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  if (!mounted) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2" aria-label="BoostAI Home">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-accent-500">
                <span className="text-white font-bold text-lg">B</span>
              </div>
              <span className="font-bold text-xl text-gray-900 dark:text-white">
                Boost<span className="text-primary-500">AI</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
              <Link href="#matrix" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors">
                Products
              </Link>
              <Link href="/roi" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors">
                ROI 测算
              </Link>
              <Link href="/pricing" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors">
                价格
              </Link>
              <Link href="/order" className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors">
                提交订单
              </Link>
              <Link href="#referral" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors">
                Referral
              </Link>
              <Link href="#wallet" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors">
                Wallet
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <Link
              href="/dashboard"
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Wallet className="h-4 w-4" />
              Dashboard
            </Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-800 animate-slide-up">
            <nav className="flex flex-col gap-4" aria-label="Mobile navigation">
              <Link href="#matrix" className="text-base font-medium text-gray-600 dark:text-gray-300 hover:text-primary-500">
                Products
              </Link>
              <Link href="#referral" className="text-base font-medium text-gray-600 dark:text-gray-300 hover:text-primary-500">
                Referral
              </Link>
              <Link href="#wallet" className="text-base font-medium text-gray-600 dark:text-gray-300 hover:text-primary-500">
                Wallet
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-2 px-4 py-3 text-base font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600"
              >
                <Wallet className="h-5 w-5" />
                Dashboard
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}