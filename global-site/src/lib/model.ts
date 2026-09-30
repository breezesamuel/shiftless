/**
 * Support staffing + automation ROI model.
 *
 * Design rules, learned from testing v1 and rejecting it:
 * 1. Never double-count coverage. Shifts-per-FTE and coverage-hours are the same
 *    idea; applying both inflated headcount ~2x (5000 tickets/mo showed 6 agents
 *    when the industry answer is 3).
 * 2. Headcount is not elastic. Nobody cuts 22 agents the week automation ships.
 *    Savings accrue via attrition over a REDUCION period, with severance as a
 *    separate, often cheaper, one-off path.
 * 3. Automation is priced per automated RESOLUTION, not a flat seat fee, which
 *    is how Intercom Fin, Gorgias and Zendesk actually bill. v1 used a flat $400
 *    that produced a 26x year-1 return — an obviously fake number that would get
 *    the whole calculator discounted to zero.
 * 4. When the honest answer is "don't buy this", say it. A tool that always
 *    agrees with the buyer is a brochure.
 */

export type Channel = "ecommerce" | "saas" | "marketplace" | "services";

export const CHANNELS: Record<
  Channel,
  {
    label: string;
    blurb: string;
    ahtP25: number;
    ahtP75: number;
    deflectable: number;
  }
> = {
  ecommerce: {
    label: "E-commerce / Shopify",
    blurb: "Order status, returns, shipping, payment issues",
    ahtP25: 7,
    ahtP75: 12,
    deflectable: 0.62,
  },
  saas: {
    label: "SaaS / Software",
    blurb: "Billing, onboarding, how-to, bug reports",
    ahtP25: 9,
    ahtP75: 18,
    deflectable: 0.55,
  },
  marketplace: {
    label: "Marketplace seller",
    blurb: "Listing questions, seller support, disputes",
    ahtP25: 5,
    ahtP75: 9,
    deflectable: 0.5,
  },
  services: {
    label: "Professional services",
    blurb: "Scheduling, quotes, client questions",
    ahtP25: 8,
    ahtP75: 15,
    deflectable: 0.48,
  },
};

export const PRODUCTIVE_HOURS_PER_SHIFT = 5.5;
/** Cash cost of removing one agent: salary + severance + recruiting the replacement. */
export const SEVERANCE_MONTHS = 2.5;
/** Months over which avoided hires compound into real cash savings. */
export const DEFAULT_REDUCTION_MONTHS = 12;

export function capacityPerShift(ahtMinutes: number): number {
  return Math.max(1, Math.floor((PRODUCTIVE_HOURS_PER_SHIFT * 60) / ahtMinutes));
}

export function shiftsPerDay(coverageHours: number): number {
  return Math.max(1, coverageHours / PRODUCTIVE_HOURS_PER_SHIFT);
}

/** Fully loaded monthly cost of one support agent. */
export function loadedCostPerAgent(loadedCostPerHour: number): number {
  return loadedCostPerHour * 8 * SHIFTS_PER_FTE * 4.33;
}

/**
 * Tickets one agent clears in a month. Must use the SAME shift count as
 * loadedCostPerAgent — the two are a matched pair, and deriving one with a
 * different divisor than the other is how you end up publishing a cost-per-ticket
 * figure of $17 for a 7-minute-AHT e-commerce queue, which is off by ~3x and
 * destroys any technical credibility the site has.
 */
export function ticketsPerAgentMonth(ahtMinutes: number): number {
  return capacityPerShift(ahtMinutes) * SHIFTS_PER_FTE * 4.33;
}

const SHIFTS_PER_FTE = 4.6;
export { SHIFTS_PER_FTE };

export type Inputs = {
  channel: Channel;
  monthlyTickets: number;
  ahtMinutes: number;
  loadedCostPerHour: number;
  coverageHoursPerDay: number;
  automationCoverage: number;
  /** Platform cost per automated resolution, USD. Typical 0.55-1.20. */
  costPerResolution: number;
  /** One-off platform setup/integration cost. */
  setupCost: number;
  /** Months over which headcount reduction phases in. */
  reductionMonths: number;
  /** Lay off to capture savings immediately instead of via attrition. */
  layoffNow: boolean;
};

export type Output = {
  agentsNeeded: number;
  agentsRange: [number, number];
  monthlyLaborCost: number;
  monthlyLaborCostRange: [number, number];
  effectiveCoverage: number;
  coverageCeilingExceeded: boolean;
  automatedTickets: number;
  humanTickets: number;
  agentsAfterAutomation: number;
  headsRemoved: number;
  monthlyPlatformCost: number;
  /** Steady-state monthly cash benefit, after the platform is paid for. */
  monthlyNetEffect: number;
  /** Cash out in year one including setup and severance. */
  yearOneNetCash: number;
  yearOneRoi: number;
  paybackMonths: number;
  verdict: "strong" | "workable" | "marginal" | "not-worth-it";
  reasons: string[];
};

export function compute(i: Inputs): Output {
  const ch = CHANNELS[i.channel];
  const perDay = i.monthlyTickets / 30;
  const cap = capacityPerShift(i.ahtMinutes);
  const spd = shiftsPerDay(i.coverageHoursPerDay);

  // Baseline FTE. One agent works ONE shift; shiftsPerDay is the crew depth
  // needed to cover the response window. Not multiplied by SHIFTS_PER_FTE here —
  // that constant only turns an hourly rate into a monthly cost.
  const agentsNeeded = Math.max(1, Math.ceil(perDay / (cap * spd)));

  // Range across the industry's p25..p75 handle time. A LONGER handle time means
  // LOWER capacity, which means MORE agents — so the p75 branch is the upper
  // bound. Stored ascending so callers can print "low-high" safely.
  const capFast = capacityPerShift(ch.ahtP25);
  const capSlow = capacityPerShift(ch.ahtP75);
  const agentsHigh = Math.max(1, Math.ceil(perDay / (capSlow * spd)));
  const agentsLow = Math.max(1, Math.ceil(perDay / (capFast * spd)));
  const agentsRange: [number, number] = [agentsLow, agentsHigh];

  const labor = loadedCostPerAgent(i.loadedCostPerHour);
  const monthlyLaborCost = agentsNeeded * labor;
  const monthlyLaborCostRange: [number, number] = [
    agentsRange[0] * labor,
    agentsRange[1] * labor,
  ];

  // --- Automation, capped at the industry's realistic ceiling ---
  const effectiveCoverage = Math.min(i.automationCoverage, ch.deflectable);
  const coverageCeilingExceeded = i.automationCoverage > ch.deflectable + 1e-9;
  const automatedTickets = i.monthlyTickets * effectiveCoverage;
  const humanTickets = i.monthlyTickets - automatedTickets;
  const agentsAfterAutomation = Math.max(
    1,
    Math.ceil(humanTickets / 30 / (cap * spd))
  );

  const headsRemoved = Math.max(0, agentsNeeded - agentsAfterAutomation);

  // Platform priced per automated resolution, the way vendors actually bill.
  const monthlyPlatformCost = automatedTickets * i.costPerResolution;

  // Headcount is not elastic.
  //
  // The phase-in floor of 1 month is load-bearing, not defensive tidying. A
  // phase-in of 0 divides by zero and published "Infinity" as your monthly
  // saving — reachable by anyone appending ?m=0 to a permalink. Even an
  // immediate cut only avoids payroll from the first full month onward, so
  // there is no honest reading of 0.
  const phaseIn = Math.max(1, i.reductionMonths);
  const monthlyGross = i.layoffNow
    ? headsRemoved * labor
    : (headsRemoved * labor * 12) / phaseIn;

  const oneOff = i.layoffNow
    ? headsRemoved * labor * (SEVERANCE_MONTHS / 12) + i.setupCost
    : i.setupCost;

  const monthlyNetEffect = monthlyGross - monthlyPlatformCost;

  // Year one: savings phase in, so average the ramp rather than crediting
  // full steady state for all 12 months.
  const rampFactor = i.layoffNow ? 1 : (1 + 0.5) / 2;
  const yearOneGross = monthlyGross * 12 * rampFactor;
  const yearOneCost = monthlyPlatformCost * 12 + oneOff;
  const yearOneNetCash = yearOneGross - yearOneCost;
  const yearOneRoi = yearOneCost > 0 ? yearOneGross / yearOneCost : 0;

  const paybackMonths =
    monthlyNetEffect > 0 ? (oneOff + monthlyPlatformCost) / monthlyNetEffect : Infinity;

  // --- Verdict ---
  const reasons: string[] = [];
  let verdict: Output["verdict"];

  if (coverageCeilingExceeded) {
    reasons.push(
      `You entered ${Math.round(i.automationCoverage * 100)}% coverage. For ${ch.label.toLowerCase()}, the realistic ceiling is about ${Math.round(ch.deflectable * 100)}%, so we modelled the ceiling. Higher figures usually come from a pilot that excluded escalations.`
    );
  }

  if (monthlyNetEffect <= 0) {
    verdict = "not-worth-it";
    reasons.push(
      `At ${i.monthlyTickets.toLocaleString()} tickets/month, the platform costs more than the headcount it lets you avoid. That is the honest answer for your volume.`
    );
  } else if (paybackMonths > 24) {
    verdict = "marginal";
    reasons.push(
      `Payback is ${Math.round(paybackMonths)} months — defensible only if you expect this volume for years.`
    );
  } else if (paybackMonths > 12) {
    verdict = "workable";
    reasons.push(
      `${paybackMonths.toFixed(1)}-month payback. Reasonable for a support org, but it is not a quick win.`
    );
  } else {
    verdict = "strong";
    reasons.push(
      `${paybackMonths.toFixed(1)}-month payback and ${yearOneRoi.toFixed(1)}x first-year return on a ${monthlyPlatformCost.toFixed(0)}/month platform fee.`
    );
  }

  if (i.monthlyTickets < 400) {
    reasons.push(
      "Below ~400 tickets/month, a good help centre and one accountable human usually beat a paid platform on both cost and quality."
    );
  }
  if (agentsRange[1] - agentsRange[0] >= 2) {
    reasons.push(
      `Headcount spans ${agentsRange[0]}-${agentsRange[1]} agents across your industry's handle-time range. Measure your real AHT for two weeks before you budget - the band is usually wider than anyone expects.`
    );
  }
  if (!i.layoffNow && headsRemoved >= 3) {
    reasons.push(
      `We phased the saving in over ${i.reductionMonths} months via attrition. Cutting ${headsRemoved} people on day one would cost roughly ${fmtShort(headsRemoved * labor * SEVERANCE_MONTHS)} in severance and is usually worse than phasing it.`
    );
  }
  if (yearOneRoi > 6) {
    reasons.push(
      `A ${yearOneRoi.toFixed(1)}x return means a large share of your support cost was avoidable labour, not overhead. Re-check that handle time and loaded rate are right - if either is overstated the return collapses.`
    );
  }

  return {
    agentsNeeded,
    agentsRange,
    monthlyLaborCost,
    monthlyLaborCostRange,
    effectiveCoverage,
    coverageCeilingExceeded,
    automatedTickets,
    humanTickets,
    agentsAfterAutomation,
    headsRemoved,
    monthlyPlatformCost,
    monthlyNetEffect,
    yearOneNetCash,
    yearOneRoi,
    paybackMonths,
    verdict,
    reasons,
  };
}

function fmtShort(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export const DEFAULTS: Inputs = {
  channel: "ecommerce",
  monthlyTickets: 3000,
  ahtMinutes: 8,
  loadedCostPerHour: 26,
  coverageHoursPerDay: 8,
  automationCoverage: 0.5,
  costPerResolution: 0.65,
  setupCost: 1500,
  reductionMonths: DEFAULT_REDUCTION_MONTHS,
  layoffNow: false,
};

export function fmtMoney(n: number): string {
  return (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
}

/* ---------------------------------------------------------------------------
 * URL state
 *
 * The growth loop for a free tool is: use it -> share the exact result -> new
 * users. A plain-text summary loses the scenario; a permalink reproduces it, and
 * "here's the link showing what this says about our team" is a far stronger
 * share than a sentence someone has to retype.
 *
 * Security: URL params are attacker-controlled input that ends up driving
 * arithmetic and arithmetic that ends up in DOM text. decodeState therefore
 * CLAMPS every value to the same bounds the sliders enforce, and drops
 * anything unparseable. Never trust these the way a naive Number() would.
 * ------------------------------------------------------------------------- */

export const STATE_VERSION = "v1";

// Exported so tests can assert the sanitiser clamps to exactly these bounds
// rather than to a second hand-copied copy of them that could drift.
export const BOUNDS = {
  monthlyTickets: { min: 100, max: 60000, int: true },
  ahtMinutes: { min: 2, max: 40, int: true },
  loadedCostPerHour: { min: 8, max: 120, int: true },
  coverageHoursPerDay: { min: 4, max: 24, int: true },
  automationCoverage: { min: 0.1, max: 0.95, int: false },
  costPerResolution: { min: 0, max: 3, int: false },
  setupCost: { min: 0, max: 40000, int: true },
} as const;

const VALID_CHANNELS = new Set<string>(Object.keys(CHANNELS));

export function encodeState(input: Partial<Inputs>): string {
  // Merge over DEFAULTS before reading any field. This function is called with
  // untrusted bodies from /api/order, where a partial object is normal, and
  // reading i.costPerResolution.toFixed() on a missing field would throw a 500
  // for the most ordinary request a client can send.
  const i = { ...DEFAULTS, ...input };
  const p = new URLSearchParams();
  p.set("v", STATE_VERSION);
  p.set("c", i.channel);
  p.set("t", String(Math.round(i.monthlyTickets)));
  p.set("a", String(Math.round(i.ahtMinutes)));
  p.set("r", String(Math.round(i.loadedCostPerHour)));
  p.set("h", String(Math.round(i.coverageHoursPerDay)));
  p.set("d", String(Math.round(i.automationCoverage * 100)));
  p.set("p", i.costPerResolution.toFixed(2));
  p.set("s", String(Math.round(i.setupCost)));
  // These two change the result materially. Omitting them would make a shared
  // permalink show a DIFFERENT answer than the person sharing it saw, which is
  // the fastest way to lose a technical audience's trust.
  p.set("m", String(Math.round(i.reductionMonths)));
  p.set("l", i.layoffNow ? "1" : "0");
  return p.toString();
}

function clampNum(raw: string | null, b: { min: number; max: number; int: boolean }): number | undefined {
  if (raw === null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  const clamped = Math.min(b.max, Math.max(b.min, n));
  return b.int ? Math.round(clamped) : Math.round(clamped * 100) / 100;
}

export function decodeState(search: string): Partial<Inputs> {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out: Partial<Inputs> = {};

  const ch = p.get("c");
  if (ch && VALID_CHANNELS.has(ch)) out.channel = ch as Channel;

  const t = clampNum(p.get("t"), BOUNDS.monthlyTickets);
  if (t !== undefined) out.monthlyTickets = t;
  const a = clampNum(p.get("a"), BOUNDS.ahtMinutes);
  if (a !== undefined) out.ahtMinutes = a;
  const r = clampNum(p.get("r"), BOUNDS.loadedCostPerHour);
  if (r !== undefined) out.loadedCostPerHour = r;
  const h = clampNum(p.get("h"), BOUNDS.coverageHoursPerDay);
  if (h !== undefined) out.coverageHoursPerDay = h;
  const s = clampNum(p.get("s"), BOUNDS.setupCost);
  if (s !== undefined) out.setupCost = s;
  const cpr = clampNum(p.get("p"), BOUNDS.costPerResolution);
  if (cpr !== undefined) out.costPerResolution = cpr;

  const d = clampNum(p.get("d"), { min: 10, max: 95, int: true });
  if (d !== undefined) out.automationCoverage = d / 100;

  const m = clampNum(p.get("m"), { min: 1, max: 36, int: true });
  if (m !== undefined) out.reductionMonths = m;
  if (p.get("l") !== null) out.layoffNow = p.get("l") === "1";

  return out;
}

export function shareUrl(i: Inputs, origin: string): string {
  return `${origin.replace(/\/$/, "")}/?${encodeState(i)}`;
}
