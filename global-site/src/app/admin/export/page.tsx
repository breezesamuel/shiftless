import { ExportClient } from "@/components/ExportClient";

export const metadata = {
  title: "Export data — Shiftless operator cockpit",
  robots: { index: false, follow: false },
};

export default function ExportPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token || "";
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Export data</h1>
      <p className="mt-2 text-sm text-slate-500">
        CSV downloads for the operator. Token-guarded (same secret as the cockpit).
      </p>
      <ExportClient token={token} />
    </main>
  );
}