"use client";

import { useCallback, useEffect, useState } from "react";

type Row = Record<string, unknown>;

type Data = {
  ok: boolean;
  leads: Row[];
  orders: Row[];
  referrals: Row[];
  missions: Row[];
  events: Row[];
  knowledge: { templates: Record<string, { drafted: number; sent: number; replied: number; failed: number }> };
  summary?: {
    kpis: {
      leads: number;
      orders: number;
      capturedOrders: number;
      pendingManualOrders: number;
      revenueUsd: number;
      revenueCny: number;
      convertedLeads: number;
      leadReplyRate: number | null;
    };
    referrers: Array<{
      referrer: string;
      referrals: number;
      monthsOwed: number;
      paidValue: number;
      currency: string;
      allPaidOut: boolean;
    }>;
  };
  autoSend: boolean;
};

export function AdminClient({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/data?token=${encodeURIComponent(token)}`);
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErr(j.error || `HTTP ${r.status}`);
        return;
      }
      setData(j as Data);
      setErr("");
    } catch (e) {
      setErr(String(e));
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action: string, id: string, outcome?: string) => {
    setBusy(id + action);
    try {
      const r = await fetch(`/api/admin/missions?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, id, outcome }),
      });
      await r.json();
      await load();
    } finally {
      setBusy("");
    }
  };

  if (err) {
    return (
      <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <p className="font-semibold">Could not load the cockpit.</p>
        <p className="mt-1">{err}</p>
        <p className="mt-2 text-xs text-rose-600">
          Check that LEAD_EXPORT_TOKEN / AGENT_ADMIN_TOKEN is set in the environment, then reload with ?token=…
        </p>
      </div>
    );
  }
  if (!data) {
    return <p className="mt-6 text-sm text-slate-500">Loading…</p>;
  }

  const pending = data.missions.filter((m) => m.status === "pending");
  const sent = data.missions.filter((m) => m.status === "sent");

  return (
    <div className="mt-6 space-y-8">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
        <span>
          leads <strong className="text-slate-900">{data.leads.length}</strong>
        </span>
        <span>
          orders <strong className="text-slate-900">{data.orders.length}</strong>
        </span>
        <span>
          referrals <strong className="text-slate-900">{data.referrals.length}</strong>
        </span>
        <span>
          missions pending <strong className="text-slate-900">{pending.length}</strong>
        </span>
        <span>
          auto-send <strong className="text-slate-900">{data.autoSend ? "ON" : "off (approval-first)"}</strong>
        </span>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {data.summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Captured revenue"
            value={`$${data.summary.kpis.revenueUsd} / ¥${data.summary.kpis.revenueCny}`}
          />
          <KpiCard
            label="Orders"
            value={`${data.summary.kpis.capturedOrders}/${data.summary.kpis.orders} captured`}
            sub={`${data.summary.kpis.pendingManualOrders} awaiting manual confirm`}
          />
          <KpiCard
            label="Lead conversion"
            value={`${data.summary.kpis.convertedLeads}/${data.summary.kpis.leads}`}
            sub="leads that became captured orders"
          />
          <KpiCard
            label="Lead reply rate"
            value={
              data.summary.kpis.leadReplyRate === null
                ? "—"
                : `${Math.round(data.summary.kpis.leadReplyRate * 100)}%`
            }
            sub="replied / sent (lead-followup)"
          />
        </div>
      )}

      <Section title="Pending missions (drafted, awaiting approval)">
        {pending.length === 0 && <Empty text="Nothing awaiting approval." />}
        {pending.map((m) => (
          <MissionRow key={String(m.id)} m={m} busy={busy} onAct={act} />
        ))}
      </Section>

      <Section title="Failed missions (need attention)">
        {data.missions.filter((m) => m.status === "failed").length === 0 && (
          <Empty text="No failed missions." />
        )}
        {data.missions
          .filter((m) => m.status === "failed")
          .map((m) => (
            <div key={String(m.id)} className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-rose-900">{String(m.subject)}</span>
                <span className="text-xs text-rose-600">
                  {String(m.kind)} → {String(m.to)} · failed
                  {m.failureReason ? ` · ${String(m.failureReason)}` : ""}
                </span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-600">
                {String(m.body)}
              </pre>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy === m.id + "retry"}
                  onClick={() => act("retry", String(m.id))}
                  className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  Retry send
                </button>
                <button
                  type="button"
                  disabled={busy === m.id + "reject"}
                  onClick={() => act("reject", String(m.id))}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
      </Section>

      <Section title="Sent missions">
        {sent.length === 0 && <Empty text="No sent missions yet." />}
        {sent.map((m) => (
          <div key={String(m.id)} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-900">{String(m.subject)}</span>
              <span className="text-xs text-slate-400">
                {String(m.kind)} → {String(m.to)} {m.outcome ? `· outcome: ${String(m.outcome)}` : ""}
              </span>
            </div>
            <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-600">
              {String(m.body)}
            </pre>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy === m.id + "outcome"}
                onClick={() => act("outcome", String(m.id), "replied")}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Mark replied
              </button>
              <button
                type="button"
                disabled={busy === m.id + "outcome"}
                onClick={() => act("outcome", String(m.id), "bounce")}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Mark bounce
              </button>
              {m.kind === "delivery" &&
                (m.deliveredAt ? (
                  <span className="text-xs text-emerald-600 py-1">
                    delivered {String(m.deliveredAt).slice(0, 10)}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy === m.id + "deliver"}
                    onClick={() => act("deliver", String(m.id))}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                  >
                    Mark delivered
                  </button>
                ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Referral settlement (by referrer)">
        {(!data.summary || data.summary.referrers.length === 0) && <Empty text="No confirmed referrals to settle." />}
        {data.summary?.referrers.map((r) => (
          <div key={r.referrer} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium text-slate-900">{r.referrer}</span>
              <span className={`text-xs ${r.allPaidOut ? "text-emerald-600" : "text-amber-600"}`}>
                {r.referrals} paid · +{r.monthsOwed} months owed · {r.currency === "USD" ? "$" : "¥"}
                {r.paidValue} · {r.allPaidOut ? "ALL SETTLED" : "payments pending"}
              </span>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Referral ledger (confirmed payments)">
        {data.referrals.length === 0 && <Empty text="No confirmed referrals yet." />}
        {data.referrals.map((r) => (
          <div key={String(r.id)} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-slate-900">
                {String(r.referrer)} → {String(r.invitee)}
              </span>
              <span className="text-xs text-slate-400">
                {String(r.orderId)} · {String(r.amount || "")} {String(r.currency || "")} ·{" "}
                {String(r.source)}
                {r.paidOutAt ? ` · PAID OUT ${String(r.paidOutAt).slice(0, 10)}` : ""}
              </span>
            </div>
            {!r.paidOutAt && (
              <div className="mt-2">
                <button
                  type="button"
                  disabled={busy === r.id + "payout"}
                  onClick={() => act("payout-referral", String(r.id))}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Mark paid out
                </button>
              </div>
            )}
          </div>
        ))}
      </Section>

      <Section title="Orders">
        {data.orders.length === 0 && <Empty text="No orders recorded yet." />}
        {data.orders.map((o) => {
          const ps = String(o.paymentState);
          const badge =
            ps === "captured"
              ? "rounded bg-emerald-100 text-emerald-800"
              : ps === "checkout-created"
              ? "rounded bg-sky-100 text-sky-800"
              : "rounded bg-amber-100 text-amber-800";
          const currency = String(o.currency || "USD");
          return (
            <div key={String(o.orderId)} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium text-slate-900">
                  {String(o.orderId)} · {String(o.tier)} · {currency === "USD" ? "$" : "¥"}
                  {String(o.priceUsd)}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium ${badge}`}>{ps}</span>
                  {String(o.email)}
                  {o.ref ? ` · ref ${String(o.ref)}` : ""}
                  {o.rail ? ` · ${String(o.rail)}` : ""}
                </span>
              </div>
              {ps === "manual" && (
                <div className="mt-2">
                  <button
                    type="button"
                    disabled={busy === String(o.orderId) + "confirm-manual"}
                    onClick={() => act("confirm-manual", String(o.orderId))}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Confirm paid (deliver)
                  </button>
                  <span className="ml-3 text-xs text-slate-400">
                    Flips capture → writes referral ledger (if ref) → drafts delivery mail.
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </Section>

      <Section title="Leads (sorted by score)">
        {data.leads.length === 0 && <Empty text="No leads yet." />}
        {data.leads.map((l) => (
          <div key={String(l.id)} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium text-slate-900">{String(l.email)}</span>
              <span className="text-xs text-slate-400">
                {typeof l.score === "number" ? (
                  <span
                    className={`mr-2 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                      l.score >= 7
                        ? "bg-emerald-100 text-emerald-800"
                        : l.score >= 4
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    score {l.score}/10
                  </span>
                ) : null}
                {String(l.source || "")} · {String(l.industry || "")} · {String(l.volume || "")} ·{" "}
                {String(l.receivedAt || "").slice(0, 10)}
                {l.ref ? ` · ref ${String(l.ref)}` : ""}
              </span>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Template learning counters">
        {Object.keys(data.knowledge.templates).length === 0 && <Empty text="No learning data yet." />}
        {Object.entries(data.knowledge.templates).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 p-3 text-sm">
            <span className="font-medium text-slate-900">{k}</span>
            <span className="ml-3 text-xs text-slate-500">
              drafted {v.drafted} · sent {v.sent} · replied {v.replied} · failed {v.failed}
            </span>
          </div>
        ))}
      </Section>

      <Section title="Agent event log (latest)">
        {data.events.length === 0 && <Empty text="No events yet." />}
        {data.events.map((e) => (
          <div key={String(e.id)} className="rounded-lg border border-slate-200 p-3 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{String(e.kind)}</span> · {String(e.ts).slice(0, 19)} ·{" "}
            {JSON.stringify(e.data).slice(0, 120)}
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-400">{text}</p>;
}

function MissionRow({
  m,
  busy,
  onAct,
}: {
  m: Row;
  busy: string;
  onAct: (action: string, id: string, outcome?: string) => void;
}) {
  const id = String(m.id);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-900">{String(m.subject)}</span>
        <span className="text-xs text-slate-400">
          {String(m.kind)} → {String(m.to)}
        </span>
      </div>
      <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-600">
        {String(m.body)}
      </pre>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={busy === id + "approve"}
          onClick={() => onAct("approve", id)}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Approve & send
        </button>
        <button
          type="button"
          disabled={busy === id + "reject"}
          onClick={() => onAct("reject", id)}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}