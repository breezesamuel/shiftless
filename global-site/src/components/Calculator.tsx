"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { LeadGate } from "@/components/LeadGate";
import { track } from "@/lib/track";
import {
  CHANNELS,
  compute,
  fmtMoney,
  DEFAULTS,
  decodeState,
  shareUrl,
  type Inputs,
  type Channel,
} from "@/lib/model";

const VERDICT_STYLE: Record<string, { label: string; cls: string }> = {
  strong: { label: "Automation pays for itself", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  workable: { label: "Workable, but not urgent", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  marginal: { label: "Marginal — long payback", cls: "bg-orange-50 text-orange-800 border-orange-200" },
  "not-worth-it": { label: "Not worth it at your volume", cls: "bg-rose-50 text-rose-800 border-rose-200" },
};

function Num({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="shrink-0 font-mono text-sm font-semibold text-slate-900">
          {prefix}
          {value.toLocaleString("en-US")}
          {suffix}
        </span>
      </div>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-brand-600"
        aria-label={label}
      />
    </div>
  );
}

export function Calculator() {
  const [i, setI] = useState<Inputs>(DEFAULTS);
  const [copied, setCopied] = useState<"none" | "text" | "link">("none");
  const [fromLink, setFromLink] = useState(false);
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) =>
    setI((p) => ({ ...p, [k]: v }));

  // Restore a shared scenario on mount. Runs once; a later reflow of the URL
  // must not yank the controls out from under someone mid-edit.
  useEffect(() => {
    const restored = decodeState(window.location.search);
    if (Object.keys(restored).length > 0) {
      setI((p) => ({ ...p, ...restored }));
      setFromLink(true);
      track("tool_view", { restored_from_url: 1 });
    } else {
      track("tool_view", { restored_from_url: 0 });
    }
  }, []);

  const out = useMemo(() => compute(i), [i]);
  const v = VERDICT_STYLE[out.verdict];

  // One result_view per distinct result, not per keystroke. Ref-guarded so the
  // slider does not fire 60 events a second.
  const lastViewed = useRef("");
  useEffect(() => {
    const sig = `${i.channel}|${i.monthlyTickets}|${i.ahtMinutes}|${i.automationCoverage}|${out.verdict}`;
    if (lastViewed.current === sig) return;
    lastViewed.current = sig;
    track("result_view", {
      channel_ecommerce: i.channel === "ecommerce" ? 1 : 0,
      channel_saas: i.channel === "saas" ? 1 : 0,
      channel_marketplace: i.channel === "marketplace" ? 1 : 0,
      channel_services: i.channel === "services" ? 1 : 0,
      monthly_tickets: i.monthlyTickets,
      aht_minutes: i.ahtMinutes,
      coverage_pct: Math.round(i.automationCoverage * 100),
      verdict_strong: out.verdict === "strong" ? 1 : 0,
      verdict_workable: out.verdict === "workable" ? 1 : 0,
      verdict_marginal: out.verdict === "marginal" ? 1 : 0,
      verdict_not_worth_it: out.verdict === "not-worth-it" ? 1 : 0,
      agents_low: out.agentsRange[0],
      net_monthly_usd: Math.round(out.monthlyNetEffect),
    });
  }, [i, out]);

  const shareText =
    `Support sizing: ${i.monthlyTickets.toLocaleString()} tickets/mo at ~${i.ahtMinutes}min ` +
    `avg handle time needs ~${out.agentsRange[0]}-${out.agentsRange[1]} agents ` +
    `(${fmtMoney(out.monthlyLaborCostRange[0])}-${fmtMoney(out.monthlyLaborCostRange[1])}/mo fully loaded). ` +
    (out.verdict === "not-worth-it"
      ? `Automation is not worth it at this volume (${fmtMoney(Math.abs(out.monthlyNetEffect))}/mo cost, no headcount to remove).`
      : `Automation: ${out.paybackMonths.toFixed(1)}mo payback, ${out.yearOneRoi.toFixed(1)}x year-1 return, ${fmtMoney(out.monthlyNetEffect)}/mo net.`);

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied("text");
      track("share_copy", { verdict_strong: out.verdict === "strong" ? 1 : 0, kind: 0 });
      setTimeout(() => setCopied("none"), 2000);
    } catch {
      setCopied("none");
    }
  };

  /**
   * Permalink. Writes the scenario into the address bar as well as the
   * clipboard, so the person can bookmark or re-share what they just built
   * without a second round trip through the copy button.
   */
  const copyLink = async () => {
    const url = shareUrl(i, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      window.history.replaceState(null, "", url);
      setCopied("link");
      track("share_copy", { verdict_strong: out.verdict === "strong" ? 1 : 0, kind: 1 });
      setTimeout(() => setCopied("none"), 2000);
    } catch {
      setCopied("none");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,430px)_1fr]">
      {/* ---------------- Inputs ---------------- */}
      <div className="no-print space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <label className="text-sm font-medium text-slate-700">Business type</label>
          <p className="mt-0.5 text-xs text-slate-500">
            Sets handle time and the realistic automation ceiling.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(Object.keys(CHANNELS) as Channel[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => set("channel", k)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  i.channel === k
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-700"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                {CHANNELS[k].label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{CHANNELS[i.channel].blurb}</p>
        </div>

        <Num label="Tickets per month" value={i.monthlyTickets} min={100} max={60000} step={100}
          onChange={(n) => set("monthlyTickets", n)} />
        <Num label="Average handle time" hint="Time an agent actually spends per ticket, including wrap-up."
          value={i.ahtMinutes} min={2} max={40} step={1} suffix=" min"
          onChange={(n) => set("ahtMinutes", n)} />
        <Num label="Fully loaded cost per agent hour" hint="Wages + benefits + supervision + seats. Not the bare hourly rate."
          value={i.loadedCostPerHour} min={8} max={120} step={1} prefix="$"
          onChange={(n) => set("loadedCostPerHour", n)} />
        <Num label="Hours of coverage per day" value={i.coverageHoursPerDay} min={4} max={24} step={1} suffix="h"
          onChange={(n) => set("coverageHoursPerDay", n)} />

        <div className="space-y-5 border-t border-slate-200 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            If you automated support
          </p>
          <Num label="Tickets resolved without a human"
            hint={`Capped at ${Math.round(CHANNELS[i.channel].deflectable * 100)}% for this industry.`}
            value={Math.round(i.automationCoverage * 100)} min={10} max={95} step={5} suffix="%"
            onChange={(n) => set("automationCoverage", n / 100)} />
          <Num label="Platform cost per automated resolution"
            hint="How Intercom Fin, Gorgias and Zendesk actually bill — typically $0.55-$1.20."
            value={i.costPerResolution} min={0} max={3} step={0.05} prefix="$"
            onChange={(n) => set("costPerResolution", n)} />
          <Num label="One-off setup and integration" value={i.setupCost} min={0} max={40000} step={250} prefix="$"
            onChange={(n) => set("setupCost", n)} />
          <Num label="Months to phase out the saved heads"
            hint="Nobody cuts 20 agents the week automation ships. Savings accrue via attrition."
            value={i.reductionMonths} min={1} max={36} step={1} suffix=" mo"
            onChange={(n) => set("reductionMonths", n)} />
        </div>
      </div>

      {/* ---------------- Results ---------------- */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${v.cls}`}>
            {v.label}
          </span>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-sm text-slate-600">Agents you need today</p>
              <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                {out.agentsRange[0]}–{out.agentsRange[1]}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {fmtMoney(out.monthlyLaborCostRange[0])} – {fmtMoney(out.monthlyLaborCostRange[1])} / month fully loaded
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">After automation</p>
              <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                {out.agentsAfterAutomation}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {out.headsRemoved} head{out.headsRemoved === 1 ? "" : "s"} removable ·{" "}
                {out.humanTickets.toLocaleString()} tickets / mo still reach a human
              </p>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Platform cost</dt>
              <dd className="mt-1 font-mono text-lg font-semibold text-slate-900">
                {fmtMoney(out.monthlyPlatformCost)}<span className="text-xs text-slate-500">/mo</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Net monthly</dt>
              <dd className={`mt-1 font-mono text-lg font-semibold ${out.monthlyNetEffect > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {out.monthlyNetEffect > 0 ? "+" : ""}{fmtMoney(out.monthlyNetEffect)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Payback</dt>
              <dd className="mt-1 font-mono text-lg font-semibold text-slate-900">
                {Number.isFinite(out.paybackMonths) ? out.paybackMonths.toFixed(1) + " mo" : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Year-1 return</dt>
              <dd className="mt-1 font-mono text-lg font-semibold text-slate-900">
                {out.yearOneRoi.toFixed(1)}x
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Why we reached that conclusion</h3>
          <ul className="mt-3 space-y-2.5">
            {out.reasons.length === 0 && (
              <li className="text-sm text-slate-600">No caveats — that is rare. Re-check the inputs.</li>
            )}
            {out.reasons.map((r, idx) => (
              <li key={idx} className="flex gap-2.5 text-sm leading-relaxed text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        {fromLink && (
          <div className="no-print rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
            Loaded from a shared link.{" "}
            <button
              type="button"
              onClick={() => {
                setI(DEFAULTS);
                setFromLink(false);
                window.history.replaceState(null, "", window.location.pathname);
              }}
              className="font-medium underline"
            >
              Reset to defaults
            </button>
          </div>
        )}

        <div className="no-print flex flex-wrap gap-3">
          <button type="button" onClick={copyShare}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
            {copied === "text" ? "Copied" : "Copy summary"}
          </button>
          <button type="button" onClick={copyLink}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
            {copied === "link" ? "Link copied" : "Copy link to this scenario"}
          </button>
          <button type="button" onClick={() => { track("print"); window.print(); }}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Print / save PDF
          </button>
        </div>

        <LeadGate
          enabled={out.verdict === "strong" || out.verdict === "workable"}
          payload={{
            monthlyTickets: i.monthlyTickets,
            ahtMinutes: i.ahtMinutes,
            loadedCostPerHour: i.loadedCostPerHour,
            channel: i.channel,
            agentsRange: `${out.agentsRange[0]}-${out.agentsRange[1]}`,
            monthlyNetEffect: Math.round(out.monthlyNetEffect),
            paybackMonths: Number.isFinite(out.paybackMonths)
              ? Number(out.paybackMonths.toFixed(1))
              : null,
            yearOneRoi: Number(out.yearOneRoi.toFixed(2)),
            verdict: out.verdict,
          }}
        />

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Share this with your team</p>
          <p className="mt-2 font-mono text-[13px] leading-relaxed text-slate-700">{shareText}</p>
        </div>
      </div>
    </div>
  );
}
