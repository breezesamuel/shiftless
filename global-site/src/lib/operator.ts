/**
 * Operator KPI summary — pure functions, no I/O.
 *
 * Everything the /admin cockpit shows as a number is computed here from the
 * ledgers the site already keeps (leads/orders/referrals/missions/knowledge).
 * Keeping it pure means it is unit-testable without a server or Blob, and the
 * admin route stays a thin serialization layer.
 *
 * The numbers are deliberately conservative:
 * - Revenue only counts orders whose paymentState is "captured" — a manual
 *   order awaiting the operator's "Confirm paid" is not revenue yet.
 * - A lead "converts" only when a captured order exists for the same email.
 * - Reply rate comes from the template knowledge counters (sent vs replied),
 *   which only move on real sends and real outcome marks.
 * - Referrer credit counts months from the PLANS table; orders whose tier is
 *   not a plan id (e.g. one-off report tiers) contribute 0 months but still
 *   count as referrals for the count.
 */
import { PLANS } from "./pricing";
import type { OrderRecord, StoredLead, ReferralRecord, AgentMission, AgentKnowledge } from "./store";

export type OperatorSummary = {
  kpis: {
    leads: number;
    orders: number;
    capturedOrders: number;
    pendingManualOrders: number;
    revenueUsd: number;
    revenueCny: number;
    convertedLeads: number;
    /** replied / sent across all lead-followup variants; null before any send. */
    leadReplyRate: number | null;
  };
  referrers: Array<{
    referrer: string;
    referrals: number;
    monthsOwed: number;
    paidValue: number;
    currency: string;
    allPaidOut: boolean;
  }>;
};

export function operatorSummary(input: {
  leads: StoredLead[];
  orders: OrderRecord[];
  referrals: ReferralRecord[];
  missions: AgentMission[];
  knowledge: AgentKnowledge;
}): OperatorSummary {
  const { leads, orders, referrals, missions, knowledge } = input;

  const captured = orders.filter((o) => o.paymentState === "captured");
  const capturedEmails = new Set(captured.map((o) => o.email.toLowerCase()));
  const leadEmails = new Set(leads.map((l) => l.email.toLowerCase()));

  let revenueUsd = 0;
  let revenueCny = 0;
  for (const o of captured) {
    const amount = Number(o.priceUsd ?? 0);
    if ((o.currency || "USD").toUpperCase() === "CNY") revenueCny += amount;
    else revenueUsd += amount;
  }

  // Reply rate from the knowledge counters over every lead-followup variant.
  let sentCount = 0;
  let repliedCount = 0;
  for (const [key, t] of Object.entries(knowledge.templates || {})) {
    if (!key.startsWith("lead-followup")) continue;
    sentCount += t.sent || 0;
    repliedCount += t.replied || 0;
  }
  const leadReplyRate = sentCount > 0 ? repliedCount / sentCount : null;

  // Group the confirmed referral ledger by referrer.
  const byReferrer = new Map<string, { rows: ReferralRecord[] }>();
  for (const r of referrals) {
    const key = (r.referrer || "").toLowerCase();
    if (!key) continue;
    const g = byReferrer.get(key) || { rows: [] };
    g.rows.push(r);
    byReferrer.set(key, g);
  }
  const referrers = Array.from(byReferrer.entries())
    .map(([referrer, g]) => {
      const monthsOwed = g.rows.reduce(
        (sum, r) => sum + ((PLANS[r.tier as keyof typeof PLANS]?.months as number) || 0),
        0
      );
      const paidValue = g.rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const currency = g.rows.find((r) => r.currency)?.currency || "USD";
      return {
        referrer,
        referrals: g.rows.length,
        monthsOwed,
        paidValue: Math.round(paidValue * 100) / 100,
        currency,
        allPaidOut: g.rows.every((r) => Boolean(r.paidOutAt)),
      };
    })
    .sort((a, b) => b.monthsOwed - a.monthsOwed || b.referrals - a.referrals);

  void missions; // reserved for future funnel analysis

  return {
    kpis: {
      leads: leads.length,
      orders: orders.length,
      capturedOrders: captured.length,
      pendingManualOrders: orders.filter((o) => o.paymentState === "manual").length,
      revenueUsd: Math.round(revenueUsd * 100) / 100,
      revenueCny: Math.round(revenueCny * 100) / 100,
      convertedLeads: Array.from(capturedEmails).filter((e) => leadEmails.has(e)).length,
      leadReplyRate,
    },
    referrers,
  };
}