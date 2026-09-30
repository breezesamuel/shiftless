'use client';

import { Copy, Check, Wallet, CreditCard, Smartphone, Globe, QrCode } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

const wallets = [
  {
    label: 'Alipay Merchant',
    value: 'supi24@163.com',
    qrValue: 'alipay://platformapi/startapp?appId=20000123&actionType=toQR&source=QR_CODE&amount=0.01&memo=BoostAI',
    type: 'email',
    icon: Smartphone,
    network: 'Alipay',
    color: 'bg-blue-500',
  },
  {
    label: 'USDC (ERC-20 / Base)',
    value: '0x12A2b19eFA9D8BC48ac156Cc8FdfC7cC0Dff36aB',
    qrValue: 'base:0x12A2b19eFA9D8BC48ac156Cc8FdfC7cC0Dff36aB?amount=0.10&token=USDC',
    type: 'address',
    icon: Globe,
    network: 'Base Mainnet',
    color: 'bg-primary-500',
  },
  {
    label: 'x402 PayTo Address',
    value: '0x12A2b19eFA9D8BC48ac156Cc8FdfC7cC0Dff36aB',
    qrValue: 'ethereum:0x12A2b19eFA9D8BC48ac156Cc8FdfC7cC0Dff36aB@8453?value=100000000000000000',
    type: 'address',
    icon: Wallet,
    network: 'x402 Bazaar',
    color: 'bg-accent-500',
  },
];

export function WalletSection() {
  const [copied, setCopied] = useState<string | null>(null);
  const [showQr, setShowQr] = useState<string | null>(null);

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleQr = (label: string) => {
    setShowQr(showQr === label ? null : label);
  };

  return (
    <section id="wallet" className="py-20 sm:py-28 lg:py-36 bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Payment <span className="text-primary-500">Wallets</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            Scan QR codes to pay. No raw addresses exposed. Transparent, auditable, no intermediaries.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {wallets.map((wallet, i) => (
            <div
              key={wallet.label}
              className="relative p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={cn('p-3 rounded-xl', wallet.color)}>
                  <wallet.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{wallet.label}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{wallet.network}</div>
                </div>
              </div>

              <div className="relative mb-4">
                <button
                  onClick={() => toggleQr(wallet.label)}
                  className="w-full aspect-square rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:border-primary-500/50 hover:shadow-lg"
                  aria-label={`Show QR code for ${wallet.label}`}
                >
                  {showQr === wallet.label ? (
                    <div className="p-4 flex items-center justify-center">
                      <QRCodeSVG
                        value={wallet.qrValue}
                        size={200}
                        level="M"
                        includeMargin={true}
                        bgColor="#ffffff"
                        fgColor="#000000"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 h-full">
                      <QrCode className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-2" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Tap to show QR
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {wallet.type === 'email' ? 'Alipay Payment' : 'USDC on Base'}
                      </span>
                    </div>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{wallet.type === 'email' ? 'Alipay QR' : 'EVM Address QR'}</span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                  <CreditCard className="h-3 w-3" />
                  Verified
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary-500/10 to-accent-500/10 dark:from-primary-900/20 dark:to-accent-900/20 border border-primary-100 dark:border-primary-900/30">
            <div className="text-3xl font-bold bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent mb-2">
              $0
            </div>
            <div className="text-gray-600 dark:text-gray-400">Fees to Us</div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">We take 0% of your revenue</div>
          </div>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-success-500/10 to-primary-500/10 dark:from-success-900/20 dark:from-primary-900/20 border border-success-100 dark:border-success-900/30">
            <div className="text-3xl font-bold bg-gradient-to-r from-success-500 to-primary-500 bg-clip-text text-transparent mb-2">
              Instant
            </div>
            <div className="text-gray-600 dark:text-gray-400">Settlement</div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">On-chain confirmation in seconds</div>
          </div>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-accent-500/10 to-success-500/10 dark:from-accent-900/20 dark:from-success-900/20 border border-accent-100 dark:border-accent-900/30">
            <div className="text-3xl font-bold bg-gradient-to-r from-accent-500 to-success-500 bg-clip-text text-transparent mb-2">
              100%
            </div>
            <div className="text-gray-600 dark:text-gray-400">Your Revenue</div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">No hidden fees, ever</div>
          </div>
        </div>
      </div>
    </section>
  );
}