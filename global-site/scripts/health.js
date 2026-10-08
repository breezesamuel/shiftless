#!/usr/bin/env node
/**
 * Health poller.
 *
 * Run: npm run health           (single check)
 *      npm run health -- watch  (poll every 60s until Ctrl-C)
 *
 * This exists because the previous failure mode was invisible. Leads were
 * written to stdout for 14 rounds; the site returned 200 the whole time and
 * nothing anywhere said a single contact had been lost. A check you have to go
 * look at is not a check — this polls the deployed deployment and prints the
 * difference between "the site is up" and "the site is actually working."
 *
 * Exits non-zero when status is critical, so it is usable as a CI gate.
 */

const args = process.argv.slice(2);
const watch = args.includes("watch");
const target =
  process.env.HEALTH_URL || "https://shiftless.vercel.app/api/health";
const INTERVAL_MS = 60_000;

const C = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function paint(status) {
  if (status === "ok") return `${C.green}ok${C.reset}`;
  if (status === "degraded") return `${C.yellow}degraded${C.reset}`;
  return `${C.red}${C.bold}CRITICAL${C.reset}`;
}

async function check() {
  const at = new Date().toISOString().slice(11, 19);
  try {
    const res = await fetch(target, { headers: { "cache-control": "no-cache" } });
    const body = await res.json();

    console.log(
      `${C.dim}${at}${C.reset}  ${paint(body.status)}  ` +
        `leads durable: ${body.leadsDurable ? `${C.green}yes${C.reset}` : `${C.red}NO${C.reset}`}`
    );

    if (body.problems?.length) {
      for (const p of body.problems) {
        const tag = p.startsWith("CRITICAL") ? C.red : p.startsWith("DEGRADED") ? C.yellow : C.dim;
        console.log(`         ${tag}${p}${C.reset}`);
      }
    }

    const off = Object.entries(body.checks || {})
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (off.length) console.log(`         ${C.dim}off: ${off.join(", ")}${C.reset}`);

    return body.status;
  } catch (e) {
    console.log(`${C.dim}${at}${C.reset}  ${C.red}unreachable${C.reset}  ${String(e)}`);
    return "critical";
  }
}

(async () => {
  const status = await check();

  if (!watch) {
    process.exitCode = status === "critical" ? 1 : 0;
    return;
  }

  if (status === "critical") {
    console.log(
      `${C.yellow}\nNot polling: the critical condition needs a human, not more checks.${C.reset}`
    );
    console.log("Provision Upstash KV or set LEAD_WEBHOOK_URL, then re-run.\n");
    process.exitCode = 1;
    return;
  }

  console.log(`${C.dim}\nwatching ${target} every 60s — Ctrl-C to stop${C.reset}\n`);
  setInterval(check, INTERVAL_MS);
})();