"use client";

import { useState, useMemo, useEffect } from "react";
import { compute, fmtMoney, DEFAULTS, CHANNELS, type Inputs, type Channel } from "@/lib/model";
import { track } from "@/lib/track";
import { SITE_URL } from "@/lib/site";

/**
 * Embeddable variant.
 *
 * Why this exists: support consultants and CX agencies put sizing calculators
 * into client proposals and QBR decks constantly. Every one of those documents is
 * a link from a real, relevant domain. That is the only durable backlink channel
 * available to a site with no brand, no customers and no PR budget — and it is
 * the exact asset the previous 508-tool build lacked, because those pages were
 * directories nobody could embed.
 *
 * Rules for the embed build:
 * - Same model, same numbers as the main tool. Divergence would make the embed
 *   a liability for anyone who embeds it.
 * - Attribution is permanent and non-configurable. If it can be removed there is
 *   no reason to keep it on.
 * - No lead capture, no email, no tracking of anything identifying. An embed
 *   inside someone's paid proposal must not embarrass them.
 */
export function EmbedCalculator() {
  const [i, setI] = useState<Inputs>(DEFAULTS);
  const out = useMemo(() => compute(i), [i]);
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setI((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    track("embed_load");
  }, []);

  const verdictColor =
    out.verdict === "strong"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : out.verdict === "workable"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : out.verdict === "marginal"
      ? "text-orange-700 bg-orange-50 border-orange-200"
      : "text-rose-700 bg-rose-50 border-rose-200";

  const verdictLabel = {
    strong: "Automation pays for itself",
    workable: "Workable, not urgent",
    marginal: "Long payback",
    "not-worth-it": "Not worth it at this volume",
  }[out.verdict];

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {/* inputs */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 18 }}>
          <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
            Business type
          </label>
          <select
            value={i.channel}
            onChange={(e) => set("channel", e.target.value as Channel)}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
          >
            {(Object.keys(CHANNELS) as Channel[]).map((k) => (
              <option key={k} value={k}>
                {CHANNELS[k].label}
              </option>
            ))}
          </select>

          <label style={{ display: "block", fontSize: 12, color: "#64748b", marginTop: 14, marginBottom: 2 }}>
            Tickets per month — <b style={{ color: "#0f172a" }}>{i.monthlyTickets.toLocaleString()}</b>
          </label>
          <input
            type="range" min={100} max={60000} step={100} value={i.monthlyTickets}
            onChange={(e) => set("monthlyTickets", Number(e.target.value))}
            style={{ width: "100%" }}
          />

          <label style={{ display: "block", fontSize: 12, color: "#64748b", marginTop: 10, marginBottom: 2 }}>
            Avg handle time — <b style={{ color: "#0f172a" }}>{i.ahtMinutes} min</b>
          </label>
          <input
            type="range" min={2} max={40} step={1} value={i.ahtMinutes}
            onChange={(e) => set("ahtMinutes", Number(e.target.value))}
            style={{ width: "100%" }}
          />

          <label style={{ display: "block", fontSize: 12, color: "#64748b", marginTop: 10, marginBottom: 2 }}>
            Loaded cost per agent hour — <b style={{ color: "#0f172a" }}>${i.loadedCostPerHour}</b>
          </label>
          <input
            type="range" min={8} max={120} step={1} value={i.loadedCostPerHour}
            onChange={(e) => set("loadedCostPerHour", Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        {/* result */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 18 }}>
          <span style={{ display: "inline-block", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999, border: `1px solid`, ...styleFromClass(verdictColor) }}>
            {verdictLabel}
          </span>

          <div style={{ display: "flex", gap: 28, marginTop: 18, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Agents needed</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#0f172a" }}>
                {out.agentsRange[0]}–{out.agentsRange[1]}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {fmtMoney(out.monthlyLaborCostRange[0])}–{fmtMoney(out.monthlyLaborCostRange[1])}/mo
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>After automation</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#0f172a" }}>{out.agentsAfterAutomation}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{out.headsRemoved} head(s) removable</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 24, marginTop: 18, paddingTop: 14, borderTop: "1px solid #e2e8f0", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Net monthly</div>
              <div style={{ fontWeight: 600, color: out.monthlyNetEffect > 0 ? "#047857" : "#be123c" }}>
                {out.monthlyNetEffect > 0 ? "+" : ""}
                {fmtMoney(out.monthlyNetEffect)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Payback</div>
              <div style={{ fontWeight: 600, color: "#0f172a" }}>
                {Number.isFinite(out.paybackMonths) ? out.paybackMonths.toFixed(1) + " mo" : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Year-1</div>
              <div style={{ fontWeight: 600, color: "#0f172a" }}>{out.yearOneRoi.toFixed(1)}x</div>
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 14, lineHeight: 1.6 }}>
        Sizing from industry benchmarks (5.5 productive hours/shift, 4.6 shifts/FTE). Automation priced
        per resolved conversation, capped at the industry ceiling.{" "}
        <a href={`${SITE_URL}/methodology`} target="_blank" rel="noopener nofollow"
          style={{ color: "#64748b" }}>
          Full methodology
        </a>{" "}
        · Powered by{" "}
        <a href={SITE_URL} target="_blank" rel="noopener" style={{ color: "#475569" }}>
          Shiftless
        </a>
      </p>
    </div>
  );
}

function styleFromClass(c: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    "text-emerald-700 bg-emerald-50 border-emerald-200": { color: "#047857", background: "#ecfdf5", borderColor: "#a7f3d0" },
    "text-amber-700 bg-amber-50 border-amber-200": { color: "#b45309", background: "#fffbeb", borderColor: "#fde68a" },
    "text-orange-700 bg-orange-50 border-orange-200": { color: "#c2410c", background: "#fff7ed", borderColor: "#fed7aa" },
    "text-rose-700 bg-rose-50 border-rose-200": { color: "#be123c", background: "#fff1f2", borderColor: "#fecdd3" },
  };
  return map[c] ?? {};
}
