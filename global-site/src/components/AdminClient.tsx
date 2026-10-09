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

      <Section title="Pending missions (drafted, awaiting approval)">
        {pending.length === 0 && <Empty text="Nothing awaiting approval." />}
        {pending.map((m) => (
          <MissionRow key={String(m.id)} m={m} busy={busy} onAct={act} />
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
            <div className="mt-2 flex gap-2">
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
                {String(r.orderId)} · {String(r.amount || "")} {String(r.currency || "")} · {String(r.source)}
              </span>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Orders">
        {data.orders.length === 0 && <Empty text="No orders recorded yet." />}
        {data.orders.map((o) => (
          <div key={String(o.orderId)} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium text-slate-900">
                {String(o.orderId)} · {String(o.tier)} · ${String(o.priceUsd)}
              </span>
              <span className="text-xs text-slate-400">
                {String(o.email)} · {String(o.paymentState)}
                {o.ref ? ` · ref ${String(o.ref)}` : ""}
              </span>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Leads">
        {data.leads.length === 0 && <Empty text="No leads yet." />}
        {data.leads.map((l) => (
          <div key={String(l.id)} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium text-slate-900">{String(l.email)}</span>
              <span className="text-xs text-slate-400">
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