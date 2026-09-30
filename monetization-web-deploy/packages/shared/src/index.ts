/**
 * Core types for the Monetization Aggregator Platform
 * Combines best practices from top 100 revenue websites
 */

import { z } from 'zod';
import { Decimal } from 'decimal.js';

// ============================================================================
// User & Authentication
// ============================================================================

export const UserRole = z.enum(['free', 'pro', 'enterprise', 'admin']);
export type UserRole = z.infer<typeof UserRole>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().optional(),
  avatar: z.string().url().optional(),
  role: UserRole.default('free'),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  alipayUserId: z.string().optional(),
  referralCode: z.string().length(8),
  referredBy: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof UserSchema>;

// ============================================================================
// Products & Services (Aggregated from multiple sources)
// ============================================================================

export const ProductCategory = z.enum([
  'tools',           // 880+ online tools
  'api',             // x402 pay-per-use APIs
  'skills',          // AI agent skills
  'templates',       // Code/design templates
  'courses',         // Educational content
  'hosting',         // Deployment/hosting
  'analytics',       // Data/analytics services
  'subscription_aggregation',  // Bundled subscription platforms
  'bundled_services',          // Telco/bank/retail super bundling
  'desktop_apps',              // Desktop app subscriptions (macOS/Windows)
  'productivity_suite',        // All-in-one productivity platforms
  'api_marketplace',           // Unified API marketplaces
]);
export type ProductCategory = z.infer<typeof ProductCategory>;

export const PricingModel = z.enum([
  'subscription',    // Monthly/yearly recurring
  'pay_per_use',     // x402 per API call
  'one_time',        // Single purchase
  'freemium',        // Free tier + paid upgrades
  'commission',      // Percentage of revenue
  'license',         // Per-seat/per-project license
]);
export type PricingModel = z.infer<typeof PricingModel>;

export const PriceSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(['USD', 'USDC', 'CNY', 'EUR']),
  interval: z.enum(['month', 'year', 'call', 'lifetime']).optional(),
  trialDays: z.number().int().nonnegative().optional(),
});
export type Price = z.infer<typeof PriceSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(100),
  name: z.string().max(200),
  description: z.string().max(5000),
  shortDescription: z.string().max(300),
  category: ProductCategory,
  pricingModel: PricingModel,
  price: PriceSchema,
  originalPrice: PriceSchema.optional(),
  images: z.array(z.string().url()).max(10).default([]),
  features: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  publisherId: z.string().uuid(),
  publisherName: z.string(),
  publisherVerified: z.boolean().default(false),
  rating: z.number().min(0).max(5).default(0),
  reviewCount: z.number().int().nonnegative().default(0),
  salesCount: z.number().int().nonnegative().default(0),
  revenue: z.number().nonnegative().default(0),
  commissionRate: z.number().min(0).max(1).default(0.15),
  affiliateCommission: z.number().min(0).max(1).default(0.10),
  status: z.enum(['draft', 'pending_review', 'active', 'rejected', 'archived']).default('draft'),
  x402Enabled: z.boolean().default(false),
  x402Config: z.object({
    network: z.string().default('eip155:8453'),
    facilitatorUrl: z.string().url().default('https://facilitator.goplausible.xyz'),
    pricePerCall: z.string().default('0.10 USD'),
    payTo: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    resourceUrl: z.string().url(),
  }).optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
  publishedAt: z.date().optional(),
});
export type Product = z.infer<typeof ProductSchema>;

// ============================================================================
// Subscriptions & Billing
// ============================================================================

export const SubscriptionTier = z.enum([
  'free',
  'starter',    // ¥10/mo - basic tools
  'pro',        // ¥99/mo - full tools + API
  'team',       // ¥299/mo - team features
  'enterprise', // Custom
]);
export type SubscriptionTier = z.infer<typeof SubscriptionTier>;

export const SubscriptionStatus = z.enum([
  'active',
  'past_due',
  'canceled',
  'trialing',
  'paused',
  'expired',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  tier: SubscriptionTier,
  status: SubscriptionStatus,
  currentPeriodStart: z.date(),
  currentPeriodEnd: z.date(),
  cancelAtPeriodEnd: z.boolean().default(false),
  trialEnd: z.date().optional(),
  alipaySubscriptionId: z.string().optional(),
  x402SubscriptionId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

// ============================================================================
// Affiliate / Referral System (Tiered like Amazon Associates)
// ============================================================================

export const ReferralTier = z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']);
export type ReferralTier = z.infer<typeof ReferralTier>;

export const ReferralTierConfig = z.object({
  tier: ReferralTier,
  minReferrals: z.number().int().nonnegative(),
  commissionRate: z.number().min(0).max(1),
  bonusPerReferral: z.number().nonnegative().default(0),
  perks: z.array(z.string()).default([]),
});
export type ReferralTierConfig = z.infer<typeof ReferralTierConfig>;

export const ReferralSchema = z.object({
  id: z.string().uuid(),
  referrerId: z.string().uuid(),
  referredId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  commissionAmount: z.number().nonnegative(),
  commissionCurrency: z.enum(['USD', 'USDC', 'CNY']).default('USD'),
  status: z.enum(['pending', 'confirmed', 'paid', 'reversed']).default('pending'),
  tierAtReferral: ReferralTier,
  clickedAt: z.date(),
  convertedAt: z.date().optional(),
  paidAt: z.date().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Referral = z.infer<typeof ReferralSchema>;

// ============================================================================
// x402 Payment Types (Bazaar-enabled)
// ============================================================================

export const X402Network = z.enum([
  'eip155:8453',     // Base Mainnet
  'eip155:84532',    // Base Sepolia
  'solana:mainnet',  // Solana Mainnet
  'solana:devnet',   // Solana Devnet
  'algorand:mainnet',
]);
export type X402Network = z.infer<typeof X402Network>;

export const PaymentRequirementsSchema = z.object({
  scheme: z.literal('exact'),
  network: X402Network,
  asset: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string(), // in base units (e.g., "100000" for 0.10 USDC)
  payTo: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  maxTimeoutSeconds: z.number().int().positive().default(300),
  extra: z.record(z.unknown()).optional(),
});
export type PaymentRequirements = z.infer<typeof PaymentRequirementsSchema>;

export const BazaarExtensionSchema = z.object({
  input: z.object({
    type: z.literal('http'),
    queryParams: z.record(z.string()),
  }),
  output: z.object({
    type: z.literal('json'),
    example: z.record(z.unknown()),
  }),
});
export type BazaarExtension = z.infer<typeof BazaarExtensionSchema>;

export const PaymentRequiredSchema = z.object({
  x402Version: z.literal(2),
  resource: z.object({
    url: z.string().url(),
    description: z.string(),
    mimeType: z.string().default('application/json'),
  }),
  accepts: z.array(PaymentRequirementsSchema),
  extensions: z.object({
    bazaar: BazaarExtensionSchema,
  }).optional(),
});
export type PaymentRequired = z.infer<typeof PaymentRequiredSchema>;

// ============================================================================
// Orders & Transactions
// ============================================================================

export const OrderStatus = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'disputed',
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  unitPrice: PriceSchema,
  totalPrice: PriceSchema,
  status: OrderStatus,
  paymentMethod: z.enum(['alipay', 'x402', 'stripe', 'balance', 'free']),
  paymentId: z.string().optional(),
  x402PaymentPayload: z.string().optional(),
  affiliateId: z.string().uuid().optional(),
  commissionAmount: z.number().nonnegative().default(0),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
});
export type Order = z.infer<typeof OrderSchema>;

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  type: z.enum(['payment', 'refund', 'commission', 'payout', 'bonus']),
  amount: z.number(),
  currency: z.enum(['USD', 'USDC', 'CNY']),
  status: z.enum(['pending', 'completed', 'failed', 'reversed']),
  blockchainTxHash: z.string().optional(),
  alipayTradeNo: z.string().optional(),
  description: z.string(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
  completedAt: z.date().optional(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

// ============================================================================
// AI Skills Marketplace
// ============================================================================

export const SkillSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(100),
  name: z.string().max(200),
  description: z.string().max(5000),
  category: z.enum(['payment', 'api', 'automation', 'data', 'content', 'analysis', 'other']),
  price: PriceSchema,
  licenseType: z.enum(['personal', 'commercial', 'enterprise', 'open_source']),
  repositoryUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
  demoUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  publisherId: z.string().uuid(),
  publisherName: z.string(),
  rating: z.number().min(0).max(5).default(0),
  installCount: z.number().int().nonnegative().default(0),
  revenue: z.number().nonnegative().default(0),
  status: z.enum(['draft', 'review', 'active', 'deprecated']).default('draft'),
  mcpCompatible: z.boolean().default(false),
  mcpConfig: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Skill = z.infer<typeof SkillSchema>;

// ============================================================================
// Analytics & Events
// ============================================================================

export const EventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  anonymousId: z.string().optional(),
  event: z.string(),
  properties: z.record(z.unknown()).default({}),
  context: z.object({
    ip: z.string().optional(),
    userAgent: z.string().optional(),
    referrer: z.string().optional(),
    utm: z.record(z.string()).optional(),
  }).optional(),
  timestamp: z.date(),
});
export type Event = z.infer<typeof EventSchema>;

// ============================================================================
// Utility Types
// ============================================================================

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
};

export const CursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
});
export type CursorPagination = z.infer<typeof CursorPaginationSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

export function toDecimal(value: number | string | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function formatCurrency(amount: Decimal | number | string, currency: string = 'USD'): string {
  const dec = toDecimal(amount);
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'USDC' ? 6 : 2,
    maximumFractionDigits: currency === 'USDC' ? 6 : 2,
  });
  return formatter.format(dec.toNumber());
}

export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function calculateCommission(amount: number, rate: number): Decimal {
  return toDecimal(amount).mul(rate).toDP(2, Decimal.ROUND_DOWN);
}

export function getReferralTier(referralCount: number): ReferralTier {
  if (referralCount >= 500) return 'diamond';
  if (referralCount >= 100) return 'platinum';
  if (referralCount >= 20) return 'gold';
  if (referralCount >= 5) return 'silver';
  return 'bronze';
}

export const DEFAULT_REFERRAL_TIERS: ReferralTierConfig[] = [
  { tier: 'bronze', minReferrals: 0, commissionRate: 0.10, bonusPerReferral: 0, perks: ['Basic tracking'] },
  { tier: 'silver', minReferrals: 5, commissionRate: 0.15, bonusPerReferral: 1, perks: ['Higher commission', '$1/referral bonus'] },
  { tier: 'gold', minReferrals: 20, commissionRate: 0.20, bonusPerReferral: 3, perks: ['20% commission', '$3/referral', 'Priority support'] },
  { tier: 'platinum', minReferrals: 100, commissionRate: 0.30, bonusPerReferral: 10, perks: ['30% commission', '$10/referral', 'Custom landing page'] },
  { tier: 'diamond', minReferrals: 500, commissionRate: 0.50, bonusPerReferral: 50, perks: ['50% commission', '$50/referral', 'Dedicated manager', 'White-label option'] },
];

export function getTierConfig(tier: ReferralTier): ReferralTierConfig {
  return DEFAULT_REFERRAL_TIERS.find(t => t.tier === tier) || DEFAULT_REFERRAL_TIERS[0];
}