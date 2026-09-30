export const WORK_HOURS = 174;
export const RAMP = 0.88;

export const AGENTS = {
  sales: { label: "AI销售员", price: 12800, human: 12000, hours: 120 },
  customer_service: { label: "AI客服员", price: 6800, human: 7000, hours: 140 },
  operations: { label: "AI运营员", price: 10800, human: 11000, hours: 100 },
  finance: { label: "AI财务员", price: 15800, human: 12000, hours: 90 },
  hr: { label: "AI招聘员", price: 12800, human: 10000, hours: 80 },
} as const;

export type AgentKey = keyof typeof AGENTS;

export const SETUP = {
  training: { label: "培训", fee: 20000, desc: "仅需人员培训与话术梳理" },
  poc: { label: "概念验证 POC", fee: 30000, desc: "4 周验证，不达标退 50%" },
  integration: { label: "系统集成", fee: 50000, desc: "标准版默认，接入现有系统" },
  custom_workflow: { label: "定制流程", fee: 80000, desc: "多场景自动化 SOP 定制" },
  deploy: { label: "私有化部署", fee: 150000, desc: "数据不出内网，含源码授权" },
} as const;

export type SetupKey = keyof typeof SETUP;

export const DISCOUNTS: [number, number][] = [
  [500, 0.72],
  [200, 0.78],
  [100, 0.82],
  [50, 0.85],
  [20, 0.9],
  [10, 0.95],
  [1, 1],
];

export const TERM_DISCOUNTS: Record<number, number> = { 1: 1, 2: 0.9, 3: 0.85 };

export function discountFor(seats: number): number {
  for (const [threshold, rate] of DISCOUNTS) {
    if (seats >= threshold) return rate;
  }
  return 1;
}

export function scaleFactor(seats: number): number {
  return Math.min(1.15, 1 + 0.01 * Math.max(0, seats - 1));
}

export function quote(agent: AgentKey, seats: number, setup: SetupKey, humanOverride?: number) {
  const a = AGENTS[agent];
  const human = humanOverride || a.human;
  const rate = discountFor(seats);
  // canonical: AGENTS.price is ALREADY the annual price per seat (do not multiply by 12)
  const annualFee = a.price * seats * rate;
  const setupFee = SETUP[setup].fee;
  const firstYear = annualFee + setupFee;
  const perSeatMonthly = a.hours * (human / WORK_HOURS);
  const monthlySaving = perSeatMonthly * seats * scaleFactor(seats);
  const humanYear = human * 12 * seats;
  const saving = monthlySaving * 12 * RAMP;
  const roi = saving / Math.max(1, firstYear);
  const net = saving - firstYear;
  const paybackMonths = monthlySaving ? firstYear / monthlySaving : 999;
  return {
    ...a,
    human,
    rate,
    annualFee,
    setupFee,
    firstYear,
    perSeatMonthly,
    monthlySaving,
    humanYear,
    saving,
    roi,
    net,
    paybackMonths,
  };
}

export function termTotal(annualFee: number, setupFee: number, termYears: number): number {
  const tRate = TERM_DISCOUNTS[termYears] ?? 1;
  return annualFee * termYears * tRate + setupFee;
}

export const CONTACT = {
  wechat: "460123249",
  phone: "+86 158 0217 8278",
  email: "460123249@qq.com",
};

export const MIN_SEATS_FOR_SALE = 3;
