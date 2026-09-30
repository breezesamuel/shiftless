"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ShoppingCart, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import {
  AGENTS, SETUP, quote, discountFor, termTotal, TERM_DISCOUNTS, CONTACT, AgentKey, SetupKey, MIN_SEATS_FOR_SALE,
} from "@/lib/pricing";

const SETUP_KEYS: SetupKey[] = ["poc", "integration", "custom_workflow", "deploy"];

const fmt = (n: number) => "¥" + Math.round(n).toLocaleString("zh-CN");

export function OrderClient() {
  const [agent, setAgent] = useState<AgentKey>("customer_service");
  const [seats, setSeats] = useState(3);
  const [setup, setSetup] = useState<SetupKey>("poc");
  const [term, setTerm] = useState<"1" | "2" | "3">("1");
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [utm] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [result, setResult] = useState<{
    orderId: string;
    delivered: boolean;
    note: string;
    fallback: { message: string; orderId: string; wechat: string; phone: string; email: string } | null;
  } | null>(null);
  const [err, setErr] = useState("");

  const q = useMemo(() => quote(agent, seats, setup), [agent, seats, setup]);
  const termYears = Number(term);
  const total = termTotal(q.annualFee, q.setupFee, termYears);
  const belowMin = seats < MIN_SEATS_FOR_SALE;

  async function submit() {
    if (!company.trim() || !name.trim() || !contact.trim()) {
      setErr("请填写企业名称、联系人与联系方式");
      return;
    }
    setErr("");
    setState("sending");
    try {
      const res = await fetch("/internal/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: "",
          company: company.trim(),
          name: name.trim(),
          contact: contact.trim(),
          plan: setup,
          planLabel: SETUP[setup].label,
          seats,
          agent,
          amount: total,
          contractTerm: `${termYears} 年`,
          notes: notes.trim(),
          utm,
        }),
      });
      const data = await res.json();
      setResult({
        orderId: data?.orderId ?? "",
        delivered: Boolean(data?.delivered),
        note: data?.note ?? "",
        fallback: data?.fallback ?? null,
      });
      setState("done");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
      setState("idle");
    }
  }

  if (state === "done" && result) {
    if (!result.delivered) {
      return (
        <div className="mx-auto max-w-2xl px-6 py-16">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-8 dark:border-amber-700 dark:bg-amber-500/10">
            <AlertTriangle className="h-12 w-12 text-amber-600" />
            <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
              订单编号已生成，但尚未成功送达
            </h1>
            <p className="mt-2 text-gray-700 dark:text-gray-300">
              订单号：<b className="font-mono">{result.orderId}</b>
            </p>
            <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
              很抱歉，我们的在线通知通道当前未接入，该订单<b>未自动保存</b>。
              请截图上方订单号，并通过下方任一方式主动联系我们，我们才能收到您的采购意向。
            </p>
            <div className="mt-6 rounded-xl bg-white p-5 text-sm dark:bg-gray-900">
              <p className="font-semibold text-gray-900 dark:text-white">请通过以下方式联系我们：</p>
              <p className="mt-2 text-gray-700 dark:text-gray-300">微信 <b>{CONTACT.wechat}</b></p>
              <p className="text-gray-700 dark:text-gray-300">电话 <b>{CONTACT.phone}</b></p>
              <p className="text-gray-700 dark:text-gray-300">邮箱 <b>{CONTACT.email}</b></p>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                报价摘要：{SETUP[setup].label} · {seats} 席 × {termYears} 年 · {AGENTS[agent].label} ·{" "}
                {fmt(total)}
              </p>
            </div>
            <button
              onClick={() => {
                setState("idle");
                setResult(null);
              }}
              className="mt-6 rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
            >
              返回修改订单
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-8 dark:border-green-900 dark:bg-green-500/10">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">订单已提交</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">订单号：<b className="font-mono">{result.orderId}</b></p>
          <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
            我们已收到你的采购意向，将由顾问在 <b>1 个工作日内</b>与你联系，确认方案细节与合同条款。急事可直接微信或电话联系我们。
          </p>
          <div className="mt-6 rounded-xl bg-white p-5 text-sm dark:bg-gray-900">
            <p className="font-semibold text-gray-900 dark:text-white">也可立即直接联系：</p>
            <p className="mt-2 text-gray-700 dark:text-gray-300">微信 <b>{CONTACT.wechat}</b></p>
            <p className="text-gray-700 dark:text-gray-300">电话 <b>{CONTACT.phone}</b></p>
            <p className="text-gray-700 dark:text-gray-300">邮箱 <b>{CONTACT.email}</b></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">提交采购订单</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          选择方案后提交订单，顾问将在 1 个工作日内联系确认并发送正式合同与付款指引。
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">1. 选择数字员工岗位</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(AGENTS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setAgent(k as AgentKey)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    agent === k
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-500/10"
                      : "border-gray-200 hover:border-primary-300 dark:border-gray-700"
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{v.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ¥{v.price.toLocaleString("zh-CN")}/席/月 · 对标人工 ¥{v.human.toLocaleString("zh-CN")}/月
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">2. 席位数</h2>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={100}
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-20 text-right font-mono text-lg">{seats} 席</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {[1, 3, 5, 10, 20, 50, 100].map((n) => (
                <button
                  key={n}
                  onClick={() => setSeats(n)}
                  className={`rounded px-2.5 py-1 ${
                    seats === n
                      ? "bg-primary-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {n} 席 · {Math.round(discountFor(n) * 100)}折
                </button>
              ))}
            </div>
            {belowMin && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                当前 {seats} 席的固定实施费摊销不足，投资回报偏低。建议按 <b>{MIN_SEATS_FOR_SALE} 席</b> 起评估；
                若只想小范围验证，请选择下方「概念验证 POC」方案。
              </p>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">3. 交付方案</h2>
            <div className="space-y-2">
              {SETUP_KEYS.map((k) => (
                <label
                  key={k}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    setup === k
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-500/10"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="setup"
                    checked={setup === k}
                    onChange={() => setSetup(k)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {SETUP[k].label}
                      <span className="ml-2 font-mono text-primary-600 dark:text-primary-400">
                        {fmt(SETUP[k].fee)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{SETUP[k].desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <h3 className="mb-2 mt-5 font-semibold text-gray-900 dark:text-white">签约周期</h3>
            <div className="flex gap-2">
              {(["1", "2", "3"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTerm(t)}
                  className={`rounded-lg px-4 py-2 text-sm ${
                    term === t
                      ? "bg-primary-500 text-white"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {t} 年{t === "2" ? "（9折）" : t === "3" ? "（85折）" : ""}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              多年签约将在年费基础上再按比例优惠，最终金额见右侧汇总。
            </p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">4. 联系信息</h2>
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-700 dark:bg-gray-800"
                placeholder="企业名称 *"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-700 dark:bg-gray-800"
                placeholder="联系人 *"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-700 dark:bg-gray-800"
                placeholder="手机 / 微信 *"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
              <textarea
                className="w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-700 dark:bg-gray-800"
                placeholder="补充说明（选填）：现有工单系统、期望上线时间、业务体量等"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              提交后上述信息将发送至我方用于商务对接，不会用于其他用途，也不会提供给第三方。
            </p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-8 h-fit">
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
              <ShoppingCart className="h-5 w-5" /> 订单汇总
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">岗位</dt>
                <dd>{AGENTS[agent].label}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">席位 × 周期</dt>
                <dd>
                  {seats} 席 × {termYears} 年
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">席位折扣</dt>
                <dd>{Math.round(discountFor(seats) * 100)} 折</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">年费小计</dt>
                <dd>{fmt(q.annualFee * termYears)}</dd>
              </div>
              {termYears > 1 && (
                <div className="flex justify-between text-primary-600 dark:text-primary-400">
                  <dt>合同期折扣（{Math.round(TERM_DISCOUNTS[termYears] * 100)} 折）</dt>
                  <dd>-{fmt(q.annualFee * termYears * (1 - TERM_DISCOUNTS[termYears]))}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{SETUP[setup].label}</dt>
                <dd>{fmt(q.setupFee)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-baseline justify-between border-t border-gray-200 pt-4 dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">合计</span>
              <span className="font-mono text-2xl font-bold text-primary-600 dark:text-primary-400">
                {fmt(total)}
              </span>
            </div>
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <div>预计年节省 <b>{fmt(q.saving)}</b></div>
              <div className="mt-1">投资回报 ROI <b>{q.roi.toFixed(1)}x</b></div>
              <div className="mt-1">回收期 <b>{Math.max(1, Math.round(q.paybackMonths))} 个月</b></div>
            </div>

            {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

            <button
              onClick={submit}
              disabled={state === "sending"}
              className="mt-5 w-full rounded-lg bg-primary-500 py-3 font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
            >
              {state === "sending" ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> 提交中…
                </span>
              ) : (
                "提交订单"
              )}
            </button>

            <p className="mt-3 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              提交订单不产生任何费用。正式合同与付款指引由顾问在联系确认后单独发送，报价以正式合同为准。
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
