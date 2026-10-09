"use client";

import { useState } from "react";

export function ExportClient({ token }: { token: string }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const download = async (kind: "leads" | "orders" | "referrals") => {
    setBusy(kind);
    setErr("");
    try {
      const r = await fetch(`/api/${kind}/export?token=${encodeURIComponent(token)}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mt-6 space-y-4">
      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {err}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <ExportCard
          title="Leads"
          desc="All captured leads with corpus context (industry, band, volume, scenario, ref)."
          busy={busy === "leads"}
          onClick={() => download("leads")}
        />
        <ExportCard
          title="Orders"
          desc="Every order with payment state, PayPal ID, referral ref, and buyer scenario."
          busy={busy === "orders"}
          onClick={() => download("orders")}
        />
        <ExportCard
          title="Referrals"
          desc="Confirmed referral ledger (deduped on orderId). Source = paypal-capture or manual."
          busy={busy === "referrals"}
          onClick={() => download("referrals")}
        />
      </div>
      <p className="mt-4 text-xs text-slate-400">
        Requires LEAD_EXPORT_TOKEN or AGENT_ADMIN_TOKEN in the environment. Blob storage must be
        configured (BLOB_READ_WRITE_TOKEN).
      </p>
    </div>
  );
}

function ExportCard({
  title,
  desc,
  busy,
  onClick,
}: {
  title: string;
  desc: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
    >
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {busy ? (
          <span className="text-sky-600">Preparing CSV…</span>
        ) : (
          <span className="text-slate-400">Click to download</span>
        )}
      </div>
    </button>
  );
}