import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * First-party, cookleless analytics.
 *
 * Why not Vercel Web Analytics or GA: /privacy currently promises "we set no
 * advertising, tracking or analytics cookies" and "no third-party ad pixels,
 * session recorders or fingerprinting scripts". Adding a third-party script
 * would quietly make that page a lie, and a privacy claim we cannot honour is
 * worse than having no analytics. So events go to our own endpoint and nowhere
 * else.
 *
 * Deliberate properties:
 * - No cookies. No localStorage. No session id, no user id, no IP-derived id.
 * - No PII is accepted or stored. Email is never an event property.
 * - A daily rotating visitor count is a hash bucket, not a fingerprint: we never
 *   store the raw value needed to reverse it.
 *
 * Storage today is the platform log (queryable with `vercel logs`). That is
 * enough to answer "is this compounding" without adding a database dependency
 * to a project whose whole point is that it deploys with one command.
 */

const BUCKETS = 64;

type Event = {
  name: string;
  path?: string;
  // Numeric measurement only. Never a string of free text — that is how PII
  // leaks into an analytics payload.
  props?: Record<string, number | boolean | undefined>;
};

const ALLOWED = new Set([
  "tool_view",
  "tool_input",
  "result_view",
  "share_copy",
  "print",
  "lead_form_view",
  "lead_submit",
  "lead_success",
  "embed_load",
]);

export async function POST(req: NextRequest) {
  let body: Event;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const name = String(body.name ?? "");
  if (!ALLOWED.has(name)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const props: Record<string, number | boolean> = {};
  if (body.props && typeof body.props === "object") {
    for (const [k, v] of Object.entries(body.props).slice(0, 12)) {
      if (typeof v === "number" && Number.isFinite(v)) props[k.slice(0, 24)] = v;
      else if (typeof v === "boolean") props[k.slice(0, 24)] = v;
    }
  }

  // Rotating, non-reversible visitor bucket. Counts unique-ish humans per day
  // without ever storing an identifier.
  const salt = new Date().toISOString().slice(0, 10);
  const raw =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("user-agent") ??
    "unknown";
  let h = 2166136261;
  const s = salt + raw;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bucket = (h >>> 0) % BUCKETS;

  console.log(
    `[EV] ${new Date().toISOString()} ${name}` +
      ` b=${bucket}` +
      ` p=${String(body.path ?? "").slice(0, 60)}` +
      (Object.keys(props).length ? ` ` + JSON.stringify(props) : ""),
  );

  return NextResponse.json({ ok: true });
}
