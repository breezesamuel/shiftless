"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReport = buildReport;
const model_1 = require("F:\\24\\global-site\\.tmp-report\\src_lib_model_ts.js");
const pct = (n) => `${Math.round(n * 100)}%`;
const num = (n) => Math.round(n).toLocaleString("en-US");
function buildReport(i) {
    const ch = model_1.CHANNELS[i.channel];
    const base = (0, model_1.compute)(i);
    const labor = (0, model_1.loadedCostPerAgent)(i.loadedCostPerHour);
    // ---- Sensitivity: the same model at -30% / flat / +50% volume ----
    const scenarios = [
        { label: "Volume -30%", tickets: Math.round(i.monthlyTickets * 0.7) },
        { label: "Volume flat", tickets: i.monthlyTickets },
        { label: "Volume +50%", tickets: Math.round(i.monthlyTickets * 1.5) },
    ].map((s) => {
        const o = (0, model_1.compute)({ ...i, monthlyTickets: s.tickets });
        return {
            ...s,
            agents: `${o.agentsRange[0]}-${o.agentsRange[1]}`,
            net: o.monthlyNetEffect,
            verdict: o.verdict,
        };
    });
    // ---- Break-even volume: where automation starts paying for itself ----
    let breakEven = 0;
    for (let t = 100; t <= 200000; t += 100) {
        if ((0, model_1.compute)({ ...i, monthlyTickets: t }).monthlyNetEffect > 0) {
            breakEven = t;
            break;
        }
    }
    const isNo = base.verdict === "not-worth-it";
    const headline = isNo
        ? `Do not buy support automation at ${num(i.monthlyTickets)} tickets/month`
        : `Support plan for ${num(i.monthlyTickets)} tickets/month: ${base.agentsRange[0]}-${base.agentsRange[1]} agents, ${base.monthlyNetEffect > 0 ? "+" : ""}${(0, model_1.fmtMoney)(base.monthlyNetEffect)}/month after automation`;
    const verdictTone = isNo
        ? "bad"
        : base.verdict === "strong"
            ? "good"
            : "warn";
    const verdict = isNo
        ? `At ${num(i.monthlyTickets)} tickets a month, automation costs more than the headcount it lets you avoid. The honest recommendation is to fix the knowledge base and keep your agent. If volume reaches roughly ${num(breakEven || 2000)} tickets a month, revisit this — that is the number that changes the answer.`
        : `Automation at ${pct(base.effectiveCoverage)} coverage is ${base.verdict === "strong" ? "clearly justified" : "defensible"} for this volume. Net effect ${base.monthlyNetEffect > 0 ? "+" : ""}${(0, model_1.fmtMoney)(base.monthlyNetEffect)}/month, ${Number.isFinite(base.paybackMonths) ? base.paybackMonths.toFixed(1) + "-month" : "no"} payback, ${base.yearOneRoi.toFixed(1)}x first-year return. The critical caveat is that savings phase in over ${i.reductionMonths} months via attrition, not immediately.`;
    const sections = [
        {
            title: "1. Current state",
            body: [
                `You handle ${num(i.monthlyTickets)} tickets a month across ${i.coverageHoursPerDay} hours of daily coverage, at an average handle time of ${i.ahtMinutes} minutes. That works out to ${num(i.monthlyTickets / 30)} tickets per day.`,
                `One agent clears ${(0, model_1.capacityPerShift)(i.ahtMinutes)} tickets per shift at that handle time, working ${model_1.PRODUCTIVE_HOURS_PER_SHIFT} productive hours. Covering ${i.coverageHoursPerDay} hours a day needs a crew depth of ${(i.coverageHoursPerDay / model_1.PRODUCTIVE_HOURS_PER_SHIFT).toFixed(2)}, and one full-time agent supplies ${model_1.SHIFTS_PER_FTE} shifts a month.`,
                `The result is ${base.agentsRange[0]}-${base.agentsRange[1]} agents. The range is not hedging: it is your industry's 25th-to-75th percentile handle time applied to your own volume, and a real team will sit somewhere inside it.`,
                `Fully loaded cost is ${(0, model_1.fmtMoney)(labor)} per agent per month, which is ${i.loadedCostPerHour}/hour including benefits, supervision, seat licences and amortised recruitment. ${num((0, model_1.ticketsPerAgentMonth)(i.ahtMinutes))} tickets per agent per month puts your cost per ticket at $${(labor / (0, model_1.ticketsPerAgentMonth)(i.ahtMinutes)).toFixed(2)}.`,
            ],
            table: {
                head: ["Measure", "Value"],
                rows: [
                    ["Tickets / month", num(i.monthlyTickets)],
                    ["Tickets / day", num(i.monthlyTickets / 30)],
                    ["Avg handle time", `${i.ahtMinutes} min`],
                    ["Capacity / agent / shift", `${(0, model_1.capacityPerShift)(i.ahtMinutes)}`],
                    ["Tickets / agent / month", num((0, model_1.ticketsPerAgentMonth)(i.ahtMinutes))],
                    ["Headcount required", `${base.agentsRange[0]}-${base.agentsRange[1]} agents`],
                    ["Loaded cost / agent / month", (0, model_1.fmtMoney)(labor)],
                    ["Cost per ticket", `$${(labor / (0, model_1.ticketsPerAgentMonth)(i.ahtMinutes)).toFixed(2)}`],
                ],
            },
        },
        {
            title: "2. What automation changes",
            body: [
                `You entered ${pct(i.automationCoverage)} coverage. For ${ch.label.toLowerCase()} the realistic ceiling is ${pct(ch.deflectable)}, so ${base.coverageCeilingExceeded ? `we modelled the ${pct(ch.deflectable)} ceiling instead` : "that is within the credible range"}. ${i.automationCoverage} tickets a month means ${num(base.automatedTickets)} conversations handled without a human and ${num(base.humanTickets)} that still reach a person.`,
                `The human queue does not halve cleanly, because the tickets that survive automation are the hardest ones. Residual headcount is ${base.agentsAfterAutomation}, which is ${base.agentsAfterAutomation < base.agentsNeeded
                    ? `${base.headsRemoved} fewer than today`
                    : "no reduction"}.`,
                `The platform is priced at $${i.costPerResolution.toFixed(2)} per automated resolution, which is how Intercom Fin, Gorgias and Zendesk actually bill. Across ${num(base.automatedTickets)} automated conversations that is ${(0, model_1.fmtMoney)(base.monthlyPlatformCost)}/month, plus ${(0, model_1.fmtMoney)(i.setupCost)} one-off.`,
            ],
            table: {
                head: ["Line", "Value"],
                rows: [
                    ["Coverage modelled", pct(base.effectiveCoverage)],
                    ["Automated / month", num(base.automatedTickets)],
                    ["Human-handled / month", num(base.humanTickets)],
                    ["Residual headcount", `${base.agentsAfterAutomation}`],
                    ["Platform cost / month", (0, model_1.fmtMoney)(base.monthlyPlatformCost)],
                    ["One-off setup", (0, model_1.fmtMoney)(i.setupCost)],
                ],
            },
        },
        {
            title: "3. Sensitivity — the part that decides the deal",
            body: [
                `Every table in every vendor deck assumes volume is flat. Yours will not be. The same plan at three volumes:`,
                `The discontinuity is the important finding. ${scenarios[0].net <= 0
                    ? "Below your current volume, the answer flips to do-not-buy, and it does so abruptly rather than gradually."
                    : "Your current volume already sits above the break-even, so downside is tolerable."} The break-even for these inputs is roughly ${num(breakEven || 2000)} tickets a month. Above that line the plan holds; below it, it does not.`,
                i.layoffNow
                    ? `You have chosen to cut immediately. Budget roughly ${(0, model_1.fmtMoney)(base.headsRemoved * labor * (model_1.SEVERANCE_MONTHS / 12))} in severance, and expect the savings to show up in full from month one. Expect attrition anyway to be the cheaper path unless the roles are genuinely redundant.`
                    : `Savings are modelled as accruing over ${i.reductionMonths} months through attrition. Nobody removes ${base.headsRemoved} people in the week automation switches on, and a plan that assumes otherwise is the single most common reason these projects are cancelled in month four.`,
            ],
            table: {
                head: ["Scenario", "Headcount", "Net / month", "Verdict"],
                rows: scenarios.map((s) => [
                    s.label,
                    s.agents,
                    `${s.net > 0 ? "+" : ""}${(0, model_1.fmtMoney)(s.net)}`,
                    s.verdict.replace(/-/g, " "),
                ]),
            },
        },
        {
            title: "4. What to do in the next 90 days",
            body: isNo
                ? [
                    `Do not buy a platform yet. Spend the 90 days on the thing automation depends on, which is a written knowledge base.`,
                    `Weeks 1-3: export every ticket from the last 90 days and label the top 50 by volume. Anything that appears more than five times is a candidate for a written answer.`,
                    `Weeks 4-6: publish answers for the top 30 and measure the repeat-contact rate before and after. This is the number that will decide the automation business case, and it costs nothing to establish.`,
                    `Weeks 7-10: re-measure average handle time with the knowledge base live. Your current ${i.ahtMinutes} minutes almost certainly falls, which reduces headcount on its own.`,
                    `Weeks 11-13: re-run this model at your real numbers. If you are still near ${num(i.monthlyTickets)} tickets a month, the answer will still be no, and that is a valid outcome to report upward.`,
                ]
                : [
                    `Days 1-30: establish the baseline before you buy anything. Measure real average handle time over two weeks, and count repeat contacts on the top 20 ticket types. Automation vendors will not do this for you and every decision downstream depends on it.`,
                    `Days 15-45: publish written answers for the 30 highest-volume ticket types. Set the expectation that coverage is ${pct(base.effectiveCoverage)}, not the ${pct(i.automationCoverage)} you wanted. A rollout planned against ${pct(i.automationCoverage)} will miss, and you will lose the internal argument a quarter from now.`,
                    `Days 30-60: pilot on one channel. Route 20-30% of traffic, hold out a control group, and measure first-response time and CSAT — not just deflection. A pilot without a control group cannot distinguish your automation from the seasonality.`,
                    `Days 60-90: decide on the residual. The plan works only if the remaining ${num(base.humanTickets)} tickets a month are genuinely handled by ${base.agentsAfterAutomation} people. If they are not, the saving you projected does not exist.`,
                    `Throughout: report savings as avoided hires, not headcount reduction, until attrition actually delivers it. That framing survives a finance review; the other one does not.`,
                ],
        },
        {
            title: "5. Risks and what would change the answer",
            body: [
                `Volume collapse. If tickets fall below roughly ${num(breakEven || 2000)}/month the plan stops paying regardless of contract length. Ask any vendor to commit to a price at that volume.`,
                `Handle time drift. Your ${i.ahtMinutes}-minute figure is an input, not a measurement. At ${model_1.CHANNELS[i.channel].ahtP25} minutes an agent clears ${num((0, model_1.ticketsPerAgentMonth)(model_1.CHANNELS[i.channel].ahtP25))} tickets a month; at ${model_1.CHANNELS[i.channel].ahtP75} minutes, ${num((0, model_1.ticketsPerAgentMonth)(model_1.CHANNELS[i.channel].ahtP75))}. That single unknown is worth more than every vendor negotiation combined.`,
                `Quality erosion. Deflection is not the same as resolution. Track CSAT on automated conversations separately from human ones; if it diverges, the repeat-contact rate will show it before your customers do.`,
                `Knowledge debt. Automation can only answer what is written down. If your support knowledge is undocumented, coverage will land at the low end of the ${pct(ch.deflectable)} ceiling no matter which platform you buy.`,
            ],
        },
    ];
    return {
        generatedFor: `${model_1.CHANNELS[i.channel].label} · ${num(i.monthlyTickets)} tickets/month`,
        headline,
        verdict,
        verdictTone,
        sections,
        appendix: [
            { label: "Productive hours per shift", value: `${model_1.PRODUCTIVE_HOURS_PER_SHIFT} h` },
            { label: "Shifts per FTE (7-day cover)", value: `${model_1.SHIFTS_PER_FTE}` },
            { label: "Industry AHT range", value: `${ch.ahtP25}-${ch.ahtP75} min` },
            { label: "Industry automation ceiling", value: pct(ch.deflectable) },
            { label: "Severance assumption", value: `${model_1.SEVERANCE_MONTHS} months` },
            { label: "Break-even volume", value: `${num(breakEven || 2000)} tickets/month` },
        ],
    };
}
