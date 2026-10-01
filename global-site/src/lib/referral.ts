/**
 * Referral reward rules — pure functions, no I/O.
 *
 * The rule set is deliberately separated from storage and from the payment
 * provider, because this is the part that decides how much product we owe.
 * A bug here costs real money, so it lives in a module with unit tests rather
 * than inside a request handler.
 *
 * Rules as specified by the operator, in both price lists:
 *   - 1 successful referral who paid >= 1 month  -> +1 month credit
 *   - 3 successful referrals, each paid a quarter -> +3 months credit
 *   - 10 successful referrals, each paid a year  -> +12 months credit
 *
 * Rewards are CUMULATIVE: tiers that have been reached are added together, so
 * ten annual referrals earn 1 + 3 + 12 = 16 months. A referral that satisfies
 * several tiers contributes to all of them — ten annual referrals each clear
 * the 1-month, 3-quarter and 10-annual bars simultaneously.
 *
 * Two invariants still guard the money, regardless of cumulation:
 *
 *   1. A referral only counts once they have actually paid, and only at the
 *      depth that was paid for. A free user who signs up and never pays
 *      contributes zero, and a referral who paid one month does not satisfy
 *      a rule that requires a quarter. `qualifiesFor` encodes that.
 *
 *   2. Each referral is counted at most once, per tier. A replayed payment
 *      webhook or a double-submitted form must not be able to inflate any
 *      tier. `dedupeReferrals` and `paidRefs` enforce that.
 */

import type { Currency, PlanId } from "./pricing";
import { PLANS } from "./pricing";

export type PaymentMethod = "alipay" | "wechat";

/** One referral, as recorded once their payment has been confirmed. */
export type Referral = {
  /** Stable identifier for the referral (the invitee's account id). */
  id: string;
  /** Plan the referral actually paid for. Null while still unpaid/free. */
  paidPlan: PlanId | null;
  /** Currency the referral paid in. Only used for display. */
  paidCurrency?: Currency;
  /** Payment method confirmed. Recorded for reconciliation, not for granting. */
  paidVia?: PaymentMethod;
  /** ISO timestamp of confirmed payment. Null while unpaid. */
  paidAt?: string | null;
};

export type RewardTierId = "none" | "first_paid" | "three_quarters" | "ten_years";

export type RewardTier = {
  id: RewardTierId;
  /** Human-facing threshold, e.g. "3 位各付满一季度". */
  label: Record<Currency, string>;
  /** How many paid referrals this tier needs. */
  minReferrals: number;
  /** Minimum paid depth per referral, in months. */
  minMonthsPerReferral: number;
  /** Months of credit granted. 0 for "none". */
  grantMonths: number;
};

/**
 * The ladder. Ordered ascending; all tiers reached are granted and summed
 * (cumulative), so ten annual referrals earn 1 + 3 + 12 = 16 months.
 */
export const REWARD_TIERS: RewardTier[] = [
  {
    id: "none",
    label: { cny: "暂无奖励", usd: "No reward yet" },
    minReferrals: 0,
    minMonthsPerReferral: 0,
    grantMonths: 0,
  },
  {
    id: "first_paid",
    label: { cny: "1 位付费满 1 个月 → 赠 1 个月", usd: "1 referral paid 1+ month → +1 month" },
    minReferrals: 1,
    minMonthsPerReferral: 1,
    grantMonths: 1,
  },
  {
    id: "three_quarters",
    label: {
      cny: "3 位各付满 1 个季度 → 赠 3 个月",
      usd: "3 referrals each paid a quarter → +3 months",
    },
    minReferrals: 3,
    minMonthsPerReferral: 3,
    grantMonths: 3,
  },
  {
    id: "ten_years",
    label: {
      cny: "10 位各付满 1 年 → 赠 1 年",
      usd: "10 referrals each paid a year → +1 year",
    },
    minReferrals: 10,
    minMonthsPerReferral: 12,
    grantMonths: 12,
  },
];

/**
 * Months a referral has actually paid for. Free signups and unpaid
 * referrals contribute 0, which is what keeps the reward honest.
 */
export function paidMonthsOf(ref: Referral): number {
  if (!ref.paidPlan || !ref.paidAt) return 0;
  return PLANS[ref.paidPlan].months;
}

/** True when this single referral is deep enough for the given tier. */
export function qualifiesFor(ref: Referral, tier: RewardTier): boolean {
  if (tier.minReferrals === 0) return true;
  if (!ref.paidPlan || !ref.paidAt) return false;
  return paidMonthsOf(ref) >= tier.minMonthsPerReferral;
}

export type RewardProgress = {
  tier: RewardTier;
  /** Referrals that paid enough to count toward this specific tier. */
  qualified: number;
  /** Referrals with any confirmed payment at all. */
  paidReferrals: number;
  /** Referrals who paid at least once but not this tier's depth. */
  paidButTooShallow: number;
  /** True once `qualified >= tier.minReferrals`. */
  reached: boolean;
  /** Referrals still needed to reach this tier. */
  remaining: number;
  /** Progress toward this tier, 0..1, counting paid-but-too-shallow as partial. */
  ratio: number;
};

/**
 * Deduplicated, payment-confirmed referrals.
 *
 * Every public entry point funnels through here rather than trusting the
 * caller's array. A payment webhook that gets redelivered, or a form
 * submitted twice, must never be able to count one person as three — that
 * is the difference between granting an owed reward and granting months we
 * were never paid for.
 */
function paidRefs(referrals: Referral[]): Referral[] {
  return dedupeReferrals(referrals).filter((r) => r.paidPlan && r.paidAt);
}

/** Progress toward every tier at once, so the UI can render a single honest
 * progress bar per reward instead of several competing ones. */
export function rewardProgress(referrals: Referral[]): RewardProgress[] {
  const paid = paidRefs(referrals);
  return REWARD_TIERS.map((tier) => {
    const qualified = paid.filter((r) => qualifiesFor(r, tier)).length;
    const paidButTooShallow = paid.length - qualified;
    const reached = qualified >= tier.minReferrals;
    // Partial credit only for referrals that paid something but not deep
    // enough. Unpaid referrals contribute 0 so the bar never over-promises.
    const effective = qualified + paidButTooShallow * 0.5;
    const denominator = Math.max(tier.minReferrals, 1);
    const ratio = tier.minReferrals === 0 ? 1 : Math.min(1, effective / denominator);
    return {
      tier,
      qualified,
      paidReferrals: paid.length,
      paidButTooShallow,
      reached,
      // Referrals that paid too shallow do not move `remaining`: they have
      // not satisfied this tier's depth, so this tier still needs its own
      // full count. Reporting fewer would under-state the real gap.
      remaining: Math.max(0, tier.minReferrals - qualified),
      ratio,
    };
  });
}

/**
 * Every tier the referrer has reached, ascending. Under cumulative rules all
 * reached tiers are granted, so this list is what gets summed.
 */
export function unlockedTiers(referrals: Referral[]): RewardTier[] {
  const paid = paidRefs(referrals);
  return REWARD_TIERS.filter(
    (t) =>
      t.minReferrals > 0 &&
      paid.filter((r) => qualifiesFor(r, t)).length >= t.minReferrals
  );
}

/** The highest tier the referrer has actually unlocked. Display only. */
export function bestTier(referrals: Referral[]): RewardTier {
  const unlocked = unlockedTiers(referrals);
  return unlocked.length ? unlocked[unlocked.length - 1] : REWARD_TIERS[0];
}

/**
 * Total months of credit granted. CUMULATIVE: the sum of every reached tier,
 * so ten annual referrals earn 1 + 3 + 12 = 16 months.
 */
export function grantedMonths(referrals: Referral[]): number {
  return unlockedTiers(referrals).reduce((sum, t) => sum + t.grantMonths, 0);
}

/**
 * Duplicate protection. A referral id may only be counted once, so a replayed
 * webhook or a double-submitted form cannot inflate the count towards a reward.
 */
export function dedupeReferrals(referrals: Referral[]): Referral[] {
  const seen = new Set<string>();
  const out: Referral[] = [];
  for (const r of referrals) {
    if (!r.id || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

/** Convenience: dedupe, then grant. */
export function settleReward(referrals: Referral[]): {
  tier: RewardTier;
  months: number;
  paidReferrals: number;
} {
  return {
    tier: bestTier(referrals),
    months: grantedMonths(referrals),
    paidReferrals: paidRefs(referrals).length,
  };
}
