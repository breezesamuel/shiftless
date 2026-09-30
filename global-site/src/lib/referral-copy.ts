/**
 * Referral programme display — server-rendered progress.
 *
 * Kept server-side because rewardProgress is pure and cheap, and because a
 * progress bar that can be inflated by client state would be a liability.
 *
 * `REWARD_PROGRAM_NOTE` states the two rules that decide whether a reward is
 * actually paid out. Both are the conservative reading, and both are shown to
 * the customer rather than buried, because a referral programme whose
 * conditions are ambiguous is a support burden later.
 */

import type { Currency } from "./pricing";
import { REWARD_TIERS } from "./referral";

export const REWARD_PROGRAM_NOTE: Record<
  Currency,
  { title: string; items: string[] }
> = {
  cny: {
    title: "推荐奖励怎么算",
    items: [
      "只算已付款的推荐人。注册了但没付钱的，不计入任何一档。",
      "按下单人付的深度判定：只付了 1 个月的不算「付满一季度」。",
      "三档奖励不叠加，取已达到的最高一档：10 位年付得 12 个月，不是 16 个月。",
      "同一推荐人只计一次，重复回调或重复提交不会重复计数。",
      "奖励在推荐人付款确认后发放，与你续费无关。",
    ],
  },
  usd: {
    title: "How referral rewards work",
    items: [
      "Only referrals who have actually paid count. A free signup contributes nothing.",
      "Depth matters per person: one month paid does not satisfy a 'quarter paid' rule.",
      "Tiers do not stack. Ten annual referrals earn 12 months, not 16.",
      "Each referral counts once; a replayed payment or duplicate form cannot inflate it.",
      "Credit is granted once the referral's payment is confirmed, independently of your own renewal.",
    ],
  },
};

/** The three reward rows, ready to render. */
export const REWARD_ROWS = REWARD_TIERS.filter((t) => t.minReferrals > 0).map((t) => ({
  id: t.id,
  label: t.label,
  minReferrals: t.minReferrals,
  minMonthsPerReferral: t.minMonthsPerReferral,
  grantMonths: t.grantMonths,
}));
