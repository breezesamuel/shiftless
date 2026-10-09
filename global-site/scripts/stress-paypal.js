/**
 * PayPal order-intake stress test.
 *
 * Fires N concurrent "standard report" checkouts at /api/order (rail=card)
 * against a target origin and reports throughput + latency. This exercises the
 * real production path: server-side price lookup, input sanitisation, the
 * in-memory throttle, PayPal auth + create-order, and the owner alert.
 *
 * Safety: orders are created with intent CAPTURE but never captured, so no
 * money moves and PayPal expires them after ~3 days. Every order triggers the
 * owner-alert email — expect N test mails in the inbox; they are artefacts,
 * not customer traffic.
 *
 * Networking: on hosts behind a local HTTP(S) proxy (e.g. Clash on
 * 127.0.0.1:7897 — where the Windows stack reaches the site but raw sockets
 * do not), pass --proxy=http://127.0.0.1:7897 or set HTTPS_PROXY. Without a
 * proxy, the script pins the real IP via Cloudflare DoH to dodge poisoned
 * resolver answers. Override the pinned address with --ip=<addr>.
 *
 * The /api/order throttle is 10/hour/IP, so keep N <= 8 per run (that limit is
 * the point of the test: beyond ~10 an operator would start seeing 429s).
 *
 * Usage: node scripts/stress-paypal.js [baseUrl] [N] [--proxy=url] [--ip=addr]
 *   baseUrl default: https://shiftless.vercel.app
 *   N default: 8
 */
"use strict";
const { ProxyAgent, Agent } = require("undici");

const BASE = process.argv[2] || "https://shiftless.vercel.app";
const N = Math.min(Math.max(1, parseInt(process.argv[3] || "8", 10)), 8);
const proxyArg = process.argv.find((a) => a.startsWith("--proxy="));
const PROXY =
  (proxyArg && proxyArg.slice(8)) ||
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  "";
const forcedIp =
  (process.argv.find((a) => a.startsWith("--ip=")) || "").slice(5) || null;

const target = new URL(BASE);
const stamp = Date.now();

async function makeDispatcher() {
  if (PROXY) {
    console.log(`proxy: ${PROXY}`);
    return { dispatcher: new ProxyAgent(PROXY), note: "proxied" };
  }
  const ip = forcedIp || (await resolveRealIp(target.hostname));
  console.log(`resolved ${target.hostname} -> ${ip} (DoH, bypasses poisoned resolver)`);
  return {
    dispatcher: new Agent({
      connect: { lookup: (h, opts, cb) => cb(null, ip, 4) },
    }),
    note: "direct-pinned",
  };
}

async function resolveRealIp(host) {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
    { headers: { accept: "application/dns-json" } }
  );
  if (!res.ok) throw new Error(`DoH failed ${res.status}`);
  const j = await res.json();
  const a = (j.Answer || []).find((r) => r.type === 1);
  if (!a) throw new Error(`DoH no A record for ${host}`);
  return a.data;
}

async function main() {
  const { dispatcher } = await makeDispatcher();

  const jobs = Array.from({ length: N }, (_, i) => {
    const email = `stress-pay-${stamp}-${i}@example.com`;
    const body = {
      email,
      tier: "standard",
      rail: "card",
      inputs: {
        channel: "ecommerce",
        monthlyTickets: 2000 + i * 250,
        ahtMinutes: 8,
        loadedCostPerHour: 34,
      },
      // A quarter of the runs carry a referrer to prove attribution survives
      // the checkout under load.
      ...(i % 4 === 0 ? { ref: "stress-referrer@example.com" } : {}),
    };
    const t0 = Date.now();
    return fetch(`${BASE}/api/order`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      dispatcher,
      signal: AbortSignal.timeout(30000),
    })
      .then(async (r) => ({
        status: r.status,
        ms: Date.now() - t0,
        body: await r.json().catch(() => null),
      }))
      .catch((e) => ({ status: 0, ms: Date.now() - t0, error: String(e) }))
      .then((r) => ({ ...r, email, ref: i % 4 === 0 }));
  });

  console.log(`target: ${BASE}`);
  const started = Date.now();
  const results = await Promise.all(jobs);
  const windowMs = Date.now() - started;

  const ok = results.filter((r) => r.status === 200 && r.body && r.body.ok === true);
  const withPay = ok.filter((r) => r.body.paymentUrl);
  const manual = ok.filter((r) => r.body.manual === true);

  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (p) =>
    ms.length ? ms[Math.min(ms.length - 1, Math.floor((ms.length - 1) * p))] : 0;

  console.log(`\nconcurrent: ${N}   total window: ${windowMs}ms`);
  console.log(
    `  ok=${ok.length}   paypal_checkout=${withPay.length}   manual_fallback=${manual.length}   failed=${results.length - ok.length}`
  );
  console.log(
    `  latency ms: p50=${pct(0.5)}  p95=${pct(0.95)}  max=${ms.length ? ms[ms.length - 1] : "-"}  sum=${ms.reduce((a, b) => a + b, 0)}`
  );

  for (const r of results) {
    if (r.status !== 200 || !r.body || !r.body.ok) {
      console.log(
        `  FAIL ${r.status || "net"} ${r.ms}ms ${r.email} ${r.error || (r.body && r.body.error) || ""}`
      );
    } else {
      console.log(
        `  ok   ${r.status} ${String(r.ms).padStart(4)}ms ${r.email} orderId=${r.body.orderId} ${r.body.paymentUrl ? "paypal" : "manual"}${r.ref ? " ref" : ""}`
      );
    }
  }

  const healthy = ok.length === N && withPay.length === N && results.length - ok.length === 0;
  console.log(`\n${healthy ? "PAYPAL-STRESS PASS" : "PAYPAL-STRESS FAIL"}`);
  process.exit(healthy ? 0 : 1);
}

main().catch((e) => {
  console.error("ERR " + e.message);
  process.exit(1);
});