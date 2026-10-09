/**
 * Product suite registry — the single source of truth for the /tools directory.
 *
 * Why this file exists: the operator had accumulated dozens of separate Vercel
 * projects, many near-duplicates of the same brand. They were consolidated down
 * to one live project per brand, and the survivors are registered here so
 * app.highkingflower.com can act as the front door for all of them.
 *
 * Two deliberate constraints:
 *  - No product copy is duplicated. Each entry is a short, plain description and
 *    links out to the product's own domain, which keeps its own pricing and
 *    checkout. The directory routes traffic; it does not host the products.
 *  - Descriptions are non-numeric where we cannot verify a number. We say what a
 *    tool does, not how much it allegedly earns, so the page stays honest.
 */

export type SuiteCategory = "free" | "research" | "business";

export type SuiteTool = {
  /** Stable id, also used as the card anchor. */
  id: string;
  url: string;
  name: string;
  nameZh: string;
  tagline: string;
  taglineZh: string;
  category: SuiteCategory;
  price: string;
  priceZh: string;
};

export const SUITE_CATEGORIES: {
  id: SuiteCategory;
  label: string;
  labelZh: string;
}[] = [
  { id: "free", label: "Free tools", labelZh: "免费工具" },
  { id: "research", label: "Research & valuation", labelZh: "研究与估值" },
  { id: "business", label: "Business & monetization", labelZh: "经营与变现" },
];

export const SUITE_TOOLS: SuiteTool[] = [
  {
    id: "shiftless",
    url: "https://app.highkingflower.com",
    name: "Shiftless",
    nameZh: "Shiftless 客服测算器",
    tagline:
      "Free calculator: how many support agents you need, and whether AI automation actually pays back at your ticket volume.",
    taglineZh:
      "免费测算客服编制与成本，以及在你这个工单量级下 AI 自动化到底值不值得买。",
    category: "free",
    price: "Free",
    priceZh: "免费",
  },
  {
    id: "pain-tools",
    url: "https://tools.highkingflower.com",
    name: "Bingdashan Pain-point Toolkit",
    nameZh: "丙大山痛点工具箱",
    tagline:
      "508 free single-purpose tools across life, work, study, health and finance, plus 1007 AI mini-games. Trilingual, opens instantly.",
    taglineZh:
      "508 个免费小工具，覆盖生活、工作、学习、健康、财务；另含 1007 个 AI 小游戏。三语、打开即用。",
    category: "free",
    price: "Free",
    priceZh: "免费",
  },
  {
    id: "ai-tools",
    url: "https://ai-tools-system.vercel.app",
    name: "AI Tools Station",
    nameZh: "AI 工具站",
    tagline: "300+ AI tools for gaming, life and work — one page, nothing to install.",
    taglineZh: "300+ 个 AI 工具，覆盖娱乐、生活与工作，打开即用，无需安装。",
    category: "free",
    price: "Free",
    priceZh: "免费",
  },
  {
    id: "solomount",
    url: "https://solomount.highkingflower.com",
    name: "Solomount",
    nameZh: "Solomount 好工具导航",
    tagline:
      "A curated directory of tools worth using — AI, no-code, indie hacking, order-taking, e-commerce and content.",
    taglineZh:
      "精选好工具导航，覆盖 AI、无代码、独立开发、接单、电商与内容创作。",
    category: "free",
    price: "Free",
    priceZh: "免费",
  },
  {
    id: "geo-audit",
    url: "https://geo-audit-24xs.vercel.app",
    name: "AI Visibility Audit",
    nameZh: "AI 可见度实测",
    tagline:
      "When a buyer asks an AI assistant 'which one is best', does it name you? A measured benchmark of 18 Chinese companies, from ¥1.",
    taglineZh:
      "当客户在 AI 里问「哪家好」，AI 提不提你？18 家中国企业实测基准，1 元起查。",
    category: "research",
    price: "From ¥1",
    priceZh: "1 元起",
  },
  {
    id: "bds-guwan",
    url: "https://bds-guwan.vercel.app",
    name: "Bingdashan Antiques Valuation",
    nameZh: "丙大山古玩市场 · 估值",
    tagline:
      "Enter an item and get a category read, market range and risk notes. Ranges come from 9,009 real auction prices; authentication still requires a licensed expert in person.",
    taglineZh:
      "输入手上的物件，算清品类归属、市场区间与风险点。区间取自 9,009 件真实拍卖成交价；真伪仍须有资质机构实物上手。",
    category: "research",
    price: "Valuation report",
    priceZh: "估值报告",
  },
  {
    id: "woyi",
    url: "https://woyi.highkingflower.com",
    name: "Woyi",
    nameZh: "我一直在",
    tagline:
      "For people stuck at a crossroads: enter a decision and take away a sourced simulation report you can come back to.",
    taglineZh:
      "给在人生里卡住的人：输入你的抉择，带走一份带出处、可回访的推演报告。",
    category: "research",
    price: "Simulation report",
    priceZh: "推演报告",
  },
  {
    id: "radar-storefront",
    url: "https://radar-storefront.vercel.app",
    name: "AI Demand Radar",
    nameZh: "AI 需求雷达",
    tagline:
      "Tracks emerging demand and turns it into auto-generated digital products you can sell.",
    taglineZh: "追踪新兴需求，自动生成可售的数字产品。",
    category: "business",
    price: "Digital storefront",
    priceZh: "数字商店",
  },
  {
    id: "smq",
    url: "https://frontend-chi-seven-58.vercel.app",
    name: "SMQ Income System",
    nameZh: "SMQ 智能赚钱系统",
    tagline:
      "An AI-assisted system for turning existing skills and content into recurring income.",
    taglineZh: "用 AI 把已有的技能和内容，变成持续收入。",
    category: "business",
    price: "System",
    priceZh: "系统",
  },
  {
    id: "reconcile",
    url: "https://ai-automation-platform-mu.vercel.app",
    name: "Reconciliation Tool",
    nameZh: "对账工具",
    tagline:
      "Paste a CSV or fill a form and get every row-level difference plus the total. Free first run; pay only if the result is useful.",
    taglineZh:
      "粘贴 CSV 或填表，当场算出逐行差额和合计。先免费算一次，满意再付钱。",
    category: "business",
    price: "Free first run",
    priceZh: "先免费算一次",
  },
  {
    id: "boostai-workforce",
    // TODO: switch to https://ai.highkingflower.com once the hichina CNAME for
    // `ai` exists — the domain is already attached to the `web` project, but it
    // currently falls through to the Aliyun wildcard and does not resolve.
    url: "https://web-kappa-ten-34.vercel.app",
    name: "BoostAI Digital Workforce",
    nameZh: "BoostAI 数字员工",
    tagline:
      "AI digital employees for sales, support, ops, finance and hiring, on a per-seat subscription. Public price list, an online ROI calculator, and a 4-week proof-of-concept with a partial refund if it misses.",
    taglineZh:
      "面向销售、客服、运营、财务、招聘的 AI 数字员工，按席位订阅。公开价目表、在线 ROI 测算，先做 4 周概念验证（POC），不达标退一半。",
    category: "business",
    price: "Per seat",
    priceZh: "按席位订阅",
  },
  {
    id: "boostai-matrix",
    url: "https://funnel-six-chi.vercel.app",
    name: "BoostAI Monetization Matrix",
    nameZh: "BoostAI 变现矩阵",
    tagline:
      "One entry point, four ways to earn: a tools subscription, per-call x402 APIs, sellable AI skills, and up to 70% referral commission.",
    taglineZh:
      "一个入口，四种变现：工具站订阅、按次计费 x402 API、可售卖的 AI 技能、最高 70% 推荐返佣。",
    category: "business",
    price: "Subscription",
    priceZh: "订阅",
  },
  {
    id: "legion",
    url: "https://workspace-olive-iota.vercel.app",
    name: "AI Legion Marketplace",
    nameZh: "AI 军团交易平台",
    tagline:
      "An experimental marketplace where autonomous AI agents take and fulfil orders.",
    taglineZh: "实验性平台：由自主 AI Agent 接单并交付。",
    category: "business",
    price: "Marketplace",
    priceZh: "交易平台",
  },
  {
    id: "x402",
    url: "https://x402.highkingflower.com",
    name: "x402 Paywalled API",
    nameZh: "x402 付费 API",
    tagline:
      "Per-call paid API endpoints. A 402 response advertises each resource so agents can discover and pay automatically.",
    taglineZh:
      "按次计费的付费 API。402 响应会声明资源，Agent 可自动发现并付费调用。",
    category: "business",
    price: "Per call",
    priceZh: "按次计费",
  },
];
