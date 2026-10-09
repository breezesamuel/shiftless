import Link from "next/link";
import { AdminClient } from "@/components/AdminClient";

export const metadata = {
  title: "Shiftless operator cockpit",
  robots: { index: false, follow: false },
};

/**
 * Operator cockpit. Token-guarded: the server component validates ?token=
 * before rendering anything, so an unauthenticated visitor sees only the
 * prompt, never the data. The token is the operator's existing export secret
 * (LEAD_EXPORT_TOKEN) or AGENT_ADMIN_TOKEN.
 */
export default function AdminPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token || "";
  const authed = Boolean(token);
  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Shiftless operator cockpit</h1>
        {authed && (
          <Link
            href={`/admin/export?token=${encodeURIComponent(token)}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </Link>
        )}
      </div>
      {!authed ? (
        <p className="mt-4 text-sm text-slate-500">
          Add <code>?token=…</code> to this URL (your export secret) to open the cockpit.
        </p>
      ) : (
        <AdminClient token={token} />
      )}
    </main>
  );
}