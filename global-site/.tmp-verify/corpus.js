"use strict";
/**
 * Programmatic page corpus definition.
 *
 * Why this exists, stated plainly because it is the whole design:
 *
 * A million pages is not a goal anyone can hit with real data. The limit is not
 * tooling, it is the number of genuinely distinct, defensible answers the model
 * can produce. This module enumerates that space honestly and reports its true
 * size, instead of padding it to a marketing number.
 *
 * Every combination below runs the real model (`compute()`) and therefore
 * carries page-specific numbers — headcount, cost, payback, verdict — that
 * cannot be produced by swapping a keyword into a template. That is the
 * distinction Google's scaled content abuse policy actually turns on, and it is
 * the reason this corpus is defensible at whatever size it turns out to be.
 *
 * Combinations whose output is *identical* to a page generated earlier in the
 * list are not emitted. That is not a nicety: publishing two URLs with the same
 * numbers and the same verdict is the doorway-page pattern, and it is exactly
 * what the policy names as abusive. Deduping by rendered result is the cheapest
 * honest guarantee that every published URL earns its existence.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HEADCOUNT_BANDS = exports.COVERAGE_SCENARIOS = exports.AHT_VARIANTS = exports.VOLUMES = exports.INDUSTRIES = exports.INDUSTRY_EDITORIAL = void 0;
exports.buildCorpus = buildCorpus;
exports.teamLabel = teamLabel;
exports.bandLabel = bandLabel;
exports.industryLabel = industryLabel;
const model_1 = require("./model");
/** Editorial layer: one hand-written line per industry. Survives template change. */
exports.INDUSTRY_EDITORIAL = {
    ecommerce: {
        en: "Order status, returns, shipping and payment questions dominate e-commerce queues, and most of them are answerable without a human.",
        zh: "订单状态、退换货、物流和支付问题是电商客服的主要构成，其中大部分不需要人工介入就能解决。",
    },
    saas: {
        en: "SaaS support skews longer: troubleshooting, billing disputes and configuration questions resist short answers more than retail queries do.",
        zh: "SaaS 客服的工单明显更长：排查、账单争议和配置类问题，比零售类问题更难用简短答案解决。",
    },
    marketplace: {
        en: "Marketplace seller support is mostly listing questions, seller onboarding and disputes, which are highly repetitive across accounts.",
        zh: "市场平台的卖家客服主要是上架问题、卖家入驻和纠纷处理，在不同账号之间高度重复。",
    },
    services: {
        en: "Professional services queues skew toward scheduling and quoting, where a single missed handoff costs far more than a slow reply.",
        zh: "专业服务类队列偏向排期和报价，其中一次交接失误的代价远高于一次回复慢。",
    },
    fintech: {
        en: "Financial support carries identity verification and compliance steps that add handling time regardless of how simple the underlying question is.",
        zh: "金融类客服包含身份核验和合规步骤，无论底层问题多简单，处理时间都会被拉长。",
    },
    travel: {
        en: "Travel and hospitality support is dominated by itinerary changes, which are time-critical: a rebooking question is worthless answered late.",
        zh: "旅游与酒店客服以行程变更为主，且具有时效性：改签问题晚一小时回答就失去了价值。",
    },
    education: {
        en: "Education platforms peak hard around term starts, so headcount built for the average month is either idle or overwhelmed.",
        zh: "教育平台在开学前后需求陡增，按平均月份配置的人力，要么闲置要么超载。",
    },
    healthcare: {
        en: "Healthcare support runs on scheduling and insurance queries with a strict escalation path, which limits how much can be automated safely.",
        zh: "医疗客服以排期和保险咨询为主，且有严格的升级路径，这限制了可安全自动化的比例。",
    },
    logistics: {
        en: "Logistics support is tracking-heavy and time-bound, where a delayed answer converts directly into a ticket about the delay.",
        zh: "物流客服以查询和时效为主，回答延迟会直接转化为一张关于延迟的投诉工单。",
    },
    gaming: {
        en: "Gaming support spikes on patch days and is dominated by account and billing issues rather than gameplay questions.",
        zh: "游戏客服在版本更新日需求激增，且以账号和账单问题为主，而非玩法类问题。",
    },
    media: {
        en: "Media and publishing support clusters around billing and account recovery, which spikes hard when a payment provider has an outage.",
        zh: "媒体与出版类客服集中在账单和账号找回，支付服务商故障时会骤然放量。",
    },
    realestate: {
        en: "Property and rental support is listing- and viewing-led, so demand is lumpy and concentrated rather than evenly distributed.",
        zh: "房产与租赁客服以房源和看房为主，需求呈块状且集中分布，并非均匀发生。",
    },
    telecom: {
        en: "Telecom support is billing- and provisioning-heavy with high repeat-contact rates, making it a prime target for self-service deflection.",
        zh: "电信客服以账单和业务办理为主，重复联系率高，是自助服务分流的首选目标。",
    },
    automotive: {
        en: "Automotive support mixes appointment scheduling, warranty claims and recall coordination — each with different urgency and automation fit.",
        zh: "汽车客服混合了预约、保修和召回协调，每类问题的紧急度和自动化适配度都不同。",
    },
    energy: {
        en: "Energy and utility support is outage- and billing-driven with strict regulatory SLAs, so escalation paths are rigid and audited.",
        zh: "能源与公用事业客服以停电和账单为主，受严格监管 SLA 约束，升级路径刚性且需审计。",
    },
    government: {
        en: "Government service desks handle permits, benefits and compliance cases with near-zero tolerance for hallucination, capping safe automation.",
        zh: "政务客服处理许可、福利和合规案件，对幻觉容忍度近乎零，安全自动化上限极低。",
    },
    nonprofit: {
        en: "Nonprofit support is donor- and volunteer-driven with seasonal spikes, running on lean teams where every hour counts.",
        zh: "非营利客服以捐赠者和志愿者为主，季节性波动大，团队精简且每小时人力都极其宝贵。",
    },
    food_delivery: {
        en: "Food delivery support is real-time and location-aware: a late order refund must arrive before the customer finishes their meal.",
        zh: "外卖客服要求实时且感知位置：退款必须在顾客吃完饭前到账。",
    },
    rideshare: {
        en: "Rideshare support splits driver and rider queues with safety-critical escalations that cannot be deflected to bots.",
        zh: "网约车客服分为司机和乘客两条队列，含安全关键升级路径，不可分流给机器人。",
    },
    crypto: {
        en: "Crypto exchange support carries KYC/AML weight and irreversible transactions, so automation stops where compliance begins.",
        zh: "加密交易所客服背负 KYC/AML 与不可逆交易，自动化止步于合规起点。",
    },
};
exports.INDUSTRIES = [
    { slug: "ecommerce", channel: "ecommerce", ceiling: 0.62, costPerHour: 34, aht: 7 },
    { slug: "saas", channel: "saas", ceiling: 0.55, costPerHour: 78, aht: 9 },
    { slug: "marketplace", channel: "marketplace", ceiling: 0.5, costPerHour: 41, aht: 5 },
    { slug: "services", channel: "services", ceiling: 0.48, costPerHour: 62, aht: 8 },
    { slug: "fintech", channel: "saas", ceiling: 0.44, costPerHour: 88, aht: 12 },
    { slug: "travel", channel: "services", ceiling: 0.58, costPerHour: 45, aht: 6 },
    { slug: "education", channel: "saas", ceiling: 0.52, costPerHour: 39, aht: 7 },
    { slug: "healthcare", channel: "services", ceiling: 0.34, costPerHour: 71, aht: 14 },
    { slug: "logistics", channel: "marketplace", ceiling: 0.61, costPerHour: 43, aht: 5 },
    { slug: "gaming", channel: "ecommerce", ceiling: 0.57, costPerHour: 48, aht: 4 },
    { slug: "media", channel: "ecommerce", ceiling: 0.59, costPerHour: 52, aht: 6 },
    { slug: "realestate", channel: "services", ceiling: 0.46, costPerHour: 56, aht: 9 },
    { slug: "telecom", channel: "saas", ceiling: 0.48, costPerHour: 55, aht: 10 },
    { slug: "automotive", channel: "services", ceiling: 0.4, costPerHour: 65, aht: 12 },
    { slug: "energy", channel: "services", ceiling: 0.35, costPerHour: 75, aht: 15 },
    { slug: "government", channel: "services", ceiling: 0.25, costPerHour: 50, aht: 12 },
    { slug: "nonprofit", channel: "ecommerce", ceiling: 0.5, costPerHour: 38, aht: 8 },
    { slug: "food_delivery", channel: "ecommerce", ceiling: 0.65, costPerHour: 30, aht: 4 },
    { slug: "rideshare", channel: "marketplace", ceiling: 0.52, costPerHour: 35, aht: 5 },
    { slug: "crypto", channel: "saas", ceiling: 0.4, costPerHour: 80, aht: 10 },
];
/** Monthly ticket volumes on a roughly geometric ladder. */
exports.VOLUMES = [
    150, 250, 400, 650, 1000, 1600, 2500, 4000, 6500, 10000, 16000, 25000, 40000, 65000,
    100000,
];
/**
 * AHT variants. Real teams run faster or slower than their industry's median —
 * deflection, macros, and agent experience all move it. This is a genuine axis
 * because it changes headcount, not just a label.
 */
exports.AHT_VARIANTS = [
    { slug: "very_fast", factor: 0.5, en: "very fast", zh: "极快" },
    { slug: "fast", factor: 0.7, en: "fast", zh: "偏快" },
    { slug: "typical", factor: 1.0, en: "typical", zh: "典型" },
    { slug: "slow", factor: 1.4, en: "slow", zh: "偏慢" },
    { slug: "very_slow", factor: 2.0, en: "very slow", zh: "极慢" },
];
/**
 * Coverage scenarios. Asks the question a cautious buyer actually asks: "what if
 * we only automate half of what we theoretically could?" Each scenario is a
 * different, correct answer to a different question.
 */
exports.COVERAGE_SCENARIOS = [
    { slug: "minimal", factor: 0.3, en: "minimal", zh: "最小化" },
    { slug: "conservative", factor: 0.5, en: "conservative", zh: "保守" },
    { slug: "base", factor: 0.78, en: "base case", zh: "基准" },
    { slug: "aggressive", factor: 0.9, en: "aggressive", zh: "激进" },
    { slug: "full", factor: 1.0, en: "full potential", zh: "满产" },
];
/** Team-size bands, because "how many people" is the question buyers ask. */
exports.HEADCOUNT_BANDS = [
    { slug: "1-5", min: 1, max: 5 },
    { slug: "6-15", min: 6, max: 15 },
    { slug: "16-40", min: 16, max: 40 },
    { slug: "41-100", min: 41, max: 100 },
    { slug: "100-plus", min: 101, max: 100000 },
];
function fmtTeam(n) {
    return n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n);
}
/**
 * Build inputs for one combination. Coverage hours scale with team size so a
 * 1-person shop and a 100-person operation are not the same problem: a small
 * team covers business hours, a large one covers extended hours. This is a real
 * modelling choice and it changes the headcount number, which is why the bands
 * are a genuine axis rather than a label.
 */
function inputsFor(industry, volume, band, ahtV, scenario) {
    const coverageHours = band.max <= 5 ? 8 : band.max <= 15 ? 12 : band.max <= 40 ? 16 : 24;
    return {
        channel: industry.channel,
        monthlyTickets: volume,
        ahtMinutes: Math.max(1, Math.round(industry.aht * ahtV.factor)),
        loadedCostPerHour: industry.costPerHour,
        coverageHoursPerDay: coverageHours,
        // The model's own ceiling still applies; the scenario scales the assumption
        // so a cautious buyer can ask a different, equally valid question.
        automationCoverage: Math.min(0.62, industry.ceiling * scenario.factor),
        costPerResolution: 0.85,
        setupCost: 8000,
        reductionMonths: 12,
        layoffNow: false,
    };
}
/** Everything that makes two pages substantively different. */
function fingerprint(o, i) {
    return [
        o.agentsNeeded,
        Math.round(o.monthlyLaborCost),
        Math.round(o.monthlyNetEffect),
        o.paybackMonths,
        o.verdict,
        Math.round(o.headsRemoved * 10),
        i.coverageHoursPerDay,
    ].join("|");
}
let cache = null;
/**
 * Enumerate the corpus, deduplicating by rendered result.
 *
 * The dedupe is the load-bearing part. Without it this module would happily
 * emit pages whose entire substance is a copy of an earlier page with one
 * different number in the title, which is the doorway pattern. With it, every
 * published page is the only page carrying its particular answer.
 */
function buildCorpus() {
    if (cache)
        return cache;
    const seen = new Set();
    const pages = [];
    let examined = 0;
    let dedupedAway = 0;
    let noindex = 0;
    for (const band of exports.HEADCOUNT_BANDS) {
        for (const industry of exports.INDUSTRIES) {
            for (const volume of exports.VOLUMES) {
                for (const ahtV of exports.AHT_VARIANTS) {
                    for (const scenario of exports.COVERAGE_SCENARIOS) {
                        examined++;
                        const inputs = inputsFor(industry, volume, band, ahtV, scenario);
                        const output = (0, model_1.compute)(inputs);
                        if (output.agentsNeeded < band.min || output.agentsNeeded > band.max)
                            continue;
                        const fp = fingerprint(output, inputs);
                        if (seen.has(fp)) {
                            dedupedAway++;
                            continue;
                        }
                        seen.add(fp);
                        const notWorthIt = output.verdict === "not-worth-it";
                        if (notWorthIt)
                            noindex++;
                        pages.push({ industry, volume, band, aht: ahtV, scenario, inputs, output, notWorthIt });
                    }
                }
            }
        }
    }
    cache = { pages, examined, dedupedAway, noindex };
    return cache;
}
function teamLabel(v) {
    return `${fmtTeam(v)} ${v >= 1000 ? "tickets" : v === 1 ? "ticket" : "tickets"}/mo`;
}
function bandLabel(slug, en) {
    const map = {
        "1-5": ["1-5 people", "1-5 人团队"],
        "6-15": ["6-15 people", "6-15 人团队"],
        "16-40": ["16-40 people", "16-40 人团队"],
        "41-100": ["41-100 people", "41-100 人团队"],
        "100-plus": ["100+ people", "100+ 人团队"],
    };
    const hit = map[slug];
    return hit ? (en ? hit[0] : hit[1]) : slug;
}
function industryLabel(slug, en) {
    const map = {
        ecommerce: ["E-commerce", "电商"],
        saas: ["SaaS", "SaaS"],
        marketplace: ["Marketplace sellers", "市场平台卖家"],
        services: ["Professional services", "专业服务"],
        fintech: ["Fintech", "金融"],
        travel: ["Travel & hospitality", "旅游与酒店"],
        education: ["Education", "教育"],
        healthcare: ["Healthcare", "医疗"],
        logistics: ["Logistics", "物流"],
        gaming: ["Gaming", "游戏"],
        media: ["Media & publishing", "媒体与出版"],
        realestate: ["Property & rentals", "房产与租赁"],
        telecom: ["Telecom", "电信"],
        automotive: ["Automotive", "汽车"],
        energy: ["Energy & utilities", "能源与公用事业"],
        government: ["Government services", "政务服务"],
        nonprofit: ["Nonprofit", "非营利组织"],
        food_delivery: ["Food delivery", "外卖配送"],
        rideshare: ["Rideshare", "网约车"],
        crypto: ["Crypto exchange", "加密交易所"],
    };
    const hit = map[slug];
    return hit ? (en ? hit[0] : hit[1]) : slug;
}
