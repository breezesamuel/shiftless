"use client";

import { useMemo, useState, useEffect } from "react";
import { Bot } from "lucide-react";
import { discountFor } from "@/lib/pricing";

const RAMP = 0.88;
const WORK_HOURS = 174;
const SETUP_FEE = 50000;
const TICKET_CAPACITY_PER_SEAT = 260;

const AGENTS = {
  ecommerce: { label: "跨境电商客服", price: 6800, human: 7500, hours: 140, tickets: 800 },
  saas: { label: "SaaS 客服", price: 8800, human: 9000, hours: 140, tickets: 700 },
  logistics: { label: "物流客服", price: 7200, human: 7800, hours: 140, tickets: 900 },
  marketplace: { label: "多平台客服", price: 7800, human: 8200, hours: 140, tickets: 850 },
} as const;

export function CSCalculator() {
  const [current, setCurrent] = useState<keyof typeof AGENTS>("ecommerce");
  const [seats, setSeats] = useState(5);
  const [tickets, setTickets] = useState<number>(AGENTS.ecommerce.tickets);

  useEffect(() => {
    setTickets(AGENTS[current].tickets);
  }, [current]);

  const r = useMemo(() => {
    const a = AGENTS[current];
    const rate = discountFor(seats);
    const scale = Math.min(1.15, 1 + 0.01 * Math.max(0, seats - 1));
    // 工单量是团队总量，除以席位数得到每席实际负荷；AI 每席最多承接 260 单/天
    const perSeatTickets = tickets / Math.max(1, seats);
    const loadFactor = Math.min(1, perSeatTickets / TICKET_CAPACITY_PER_SEAT);
    const coveredHours = a.hours * loadFactor;
    const perSeatMonthly = coveredHours * (a.human / WORK_HOURS);
    const monthlySaving = perSeatMonthly * seats * scale;
    const agentYear = a.price * seats * rate;
    const firstYear = agentYear + SETUP_FEE;
    const humanYear = a.human * 12 * seats;
    const saving = monthlySaving * 12 * RAMP;
    const roi = saving / Math.max(1, firstYear);
    const payback = monthlySaving ? firstYear / monthlySaving : 999;
    return { ...a, humanYear, agentYear, firstYear, saving, roi, payback, tickets, coveredHours };
  }, [current, seats, tickets]);

  return (
    <div className="roi-wrap">
      <div className="roi-card">
        <div className="roi-header">
          <Bot className="h-6 w-6 text-primary-500" />
          <h2>客服团队降本增效 ROI 测算</h2>
          <span className="roi-badge">首年口径 · 含 ¥50,000 实施费</span>
        </div>
        <div className="roi-grid">
          <div className="roi-panel">
            <h3>参数配置</h3>
            <div className="roi-row">
              <label>业务类型</label>
              <select value={current} onChange={(e) => setCurrent(e.target.value as keyof typeof AGENTS)}>
                {Object.entries(AGENTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="roi-row">
              <label>客服席位数</label>
              <input type="range" min={1} max={50} value={seats} onChange={(e) => setSeats(+e.target.value)} />
              <div className="roi-val">{seats} 席</div>
            </div>
            <div className="roi-row">
              <label>日均工单量（预估）</label>
              <input type="range" min={100} max={5000} step={50} value={tickets} onChange={(e) => setTickets(+e.target.value)} />
              <div className="roi-val">{tickets}/天</div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              团队日均 {tickets} 单 ÷ {seats} 席 = 每席 {(tickets / Math.max(1, seats)).toFixed(0)} 单/天；
              AI 每席上限 {TICKET_CAPACITY_PER_SEAT} 单/天，故实际承接{" "}
              <b>{r.coveredHours.toFixed(0)} h/月</b>（岗位上限 {AGENTS[current].hours} h/月）。
              工单量不足时能替代的人力会下降——这是保守口径，不按满负荷承诺。
            </p>
          </div>
          <div className="roi-panel">
            <h3>测算结果</h3>
            <div className="roi-kpi">
              <div>
                <span>年省金额</span>
                <strong>¥{Math.round(r.saving).toLocaleString("zh-CN")}</strong>
              </div>
              <div>
                <span>ROI</span>
                <strong>{r.roi.toFixed(2)}x</strong>
              </div>
              <div>
                <span>回收期</span>
                <strong>{Math.max(1, Math.round(r.payback))} 个月</strong>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              首年总投入 ¥{Math.round(r.firstYear).toLocaleString("zh-CN")}
              （含 ¥{SETUP_FEE.toLocaleString("zh-CN")} 系统集成费）。1 席 ROI 仅约 1x，
              建议 3 席起评估。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
