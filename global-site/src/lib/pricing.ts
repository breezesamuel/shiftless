/**
 * Pricing + plan entitlements — single source of truth.
 *
 * Server-authoritative: /api/geo-order re-reads prices from this table and
 * ignores whatever the client sends, so a tampered request cannot change
 * what is owed. Client components import the same table for display, which
 * means the price shown and the price charged cannot drift apart.
 *
 * Currencies: CNY is charged in China, USD everywhere else. There is no FX
 * conversion between them — each is an independent price list for the same
 * entitlement. That is deliberate: converting would silently change what a
 * customer agreed to pay.
 */

export const CURRENCIES = ["cny", "usd"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type PlanId = "monthly" | "quarterly" | "yearly";

export type Plan = {
  id: PlanId;
  /** Grant length in days. Used to extend entitlement, not to bill. */
  days: number;
  /** Grant length in whole months, for referral credit arithmetic. */
  months: number;
  label: Record<Currency, string>;
  price: Record<Currency, number>;
  /** Per-period price normalised to one month, for honest "effective rate" copy. */
  monthlyEquivalent: Record<Currency, number>;
  blurb: Record<Currency, string>;
};

export const PLANS: Record<PlanId, Plan> = {
  monthly: {
    id: "monthly",
    days: 30,
    months: 1,
    label: { cny: "按月", usd: "Monthly" },
    price: { cny: 60, usd: 9.9 },
    monthlyEquivalent: { cny: 60, usd: 9.9 },
    blurb: {
      cny: "随时停。先试一个月再决定。",
      usd: "Cancel any time. Try one month, then decide.",
    },
  },
  quarterly: {
    id: "quarterly",
    days: 90,
    months: 3,
    label: { cny: "按季", usd: "Quarterly" },
    price: { cny: 150, usd: 25 },
    monthlyEquivalent: { cny: 50, usd: 8.33 },
    blurb: {
      cny: "相当于每月 ¥50。刚好跑满一轮「改 → 复审 → 看曲线」。",
      usd: "About $8.33/mo. Exactly one full fix → recheck → curve cycle.",
    },
  },
  yearly: {
    id: "yearly",
    days: 365,
    months: 12,
    label: { cny: "按年", usd: "Yearly" },
    price: { cny: 500, usd: 99 },
    monthlyEquivalent: { cny: 41.67, usd: 8.25 },
    blurb: {
      cny: "相当于每月 ¥41.67。最便宜，也是推荐档。",
      usd: "About $8.25/mo. Cheapest per month, and the one we recommend.",
    },
  },
};

export const PLAN_ORDER: PlanId[] = ["monthly", "quarterly", "yearly"];

/** Free uses every new visitor gets before a paid plan is required. */
export const FREE_USES = 10;

export function isCurrency(v: unknown): v is Currency {
  return v === "cny" || v === "usd";
}

export function isPlanId(v: unknown): v is PlanId {
  return v === "monthly" || v === "quarterly" || v === "yearly";
}

export function getPlan(id: unknown): Plan | null {
  return isPlanId(id) ? PLANS[id] : null;
}

/** Server-side price lookup. Never trust a client-supplied amount. */
export function priceOf(id: PlanId, currency: Currency): number {
  return PLANS[id].price[currency];
}

const CURRENCY_SYMBOL: Record<Currency, string> = { cny: "¥", usd: "$" };

export function formatPrice(amount: number, currency: Currency): string {
  // Whole units stay integral; only the cents matter for USD.
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return `${CURRENCY_SYMBOL[currency]}${amount.toFixed(decimals)}`;
}

/**
 * What the free tier actually covers, stated precisely so the paywall copy
 * cannot over-promise. This is the honest boundary: free uses run the audit,
 * they do not run the quarter-over-quarter comparison, which is the whole
 * reason the paid tier exists.
 */
export const FREE_TIER_COPY = {
  cny: {
    headline: "免费 10 次",
    detail:
      "新用户自动获得 10 次免费审计，覆盖官网根页与 11 项可读性检查。免费额度用完后才需要订阅；季度对比与变化曲线属于付费档。",
    limit: "免费额度仅含单页审计，不含季度对比与整改建议。",
  },
  usd: {
    headline: "10 free runs",
    detail:
      "Every new visitor gets 10 free audits of one page against 11 readability checks. A plan is only needed after those run out; quarter-over-quarter comparison and trend curves are paid.",
    limit: "Free runs cover a single page. No quarter comparison, no remediation advice.",
  },
} as const;
