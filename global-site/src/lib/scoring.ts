/**
 * Lead scoring — pure functions, no I/O.
 *
 * The score decides where the operator's limited attention goes first. It is
 * deliberately built from signals the lead already carries (never guessed from
 * anything we do not hold) and is clamped to 0..10 so a big number can never
 * look like a certainty.
 *
 * What each signal means:
 * - Completeness: an email plus the three calculator inputs means the lead was
 *   willing to describe its funnel, which is strong purchase intent.
 * - Volume: more tickets per month = more headcount hours on the line = larger
 *   automation surface. Scored sub-linearly so 100k tickets is not 20x a 5k
 *   lead.
 * - Verdict: "strong" / "viable" come out of the honest ROI model and already
 *   mean the numbers pay back; "not-worth-it" floors the score rather than
 *   zeroing it (the site told them it may not pay, but they still asked).
 * - Year-one ROI: a multiple over 3x is an easy yes. Over 1x is worth a look.
 * - Source: an organic corpus page (already about their exact industry + band)
 *   is warmer than the generic calculator.
 * - Referral: someone's shared link brought them, which is a personal
 *   introduction as far as a cold funnel gets.
 */
export type ScoreInput = {
  email?: string | null;
  industry?: string | null;
  monthlyTickets?: number | null;
  ahtMinutes?: number | null;
  volume?: number | null;
  band?: string | null;
  scenario?: string | null;
  verdict?: string | null;
  yearOneRoi?: number | null;
  source?: string | null;
  ref?: string | null;
};

export function scoreLead(lead: ScoreInput): number {
  let s = 0;

  // Completeness (0..2)
  if (lead.email) s += 1;
  if (lead.monthlyTickets || lead.ahtMinutes) s += 1;
  if ((lead.monthlyTickets && lead.ahtMinutes) || lead.volume) s += 1;
  s = Math.min(3, s); // three possible completeness points, capped

  // Volume (0..3, sub-linear)
  const volume = Number(lead.volume ?? lead.monthlyTickets ?? 0);
  if (volume > 0) s += Math.min(3, Math.floor(volume / 500) + (volume >= 250 ? 1 : 0));

  // Honest-model verdict (0..3)
  const verdict = String(lead.verdict || "").toLowerCase();
  if (verdict.includes("strong")) s += 3;
  else if (verdict.includes("viable")) s += 2;
  else if (verdict.includes("worth")) s -= 1; // "not worth it" → floor signal

  // Year-one ROI (0..3)
  const roi = Number(lead.yearOneRoi ?? 0);
  if (roi >= 3) s += 3;
  else if (roi >= 1) s += 2;
  else if (roi > 0) s += 1;

  // Organic corpus context (0..1)
  const source = String(lead.source || "");
  if (source.includes("corpus") && (lead.industry || lead.band || lead.scenario)) s += 1;

  // Referral warmth (0..1)
  if (lead.ref && lead.ref.includes("@")) s += 1;

  return Math.max(0, Math.min(10, s));
}