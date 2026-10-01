/**
 * Regression guard: the quarterly recheck endpoint must never 304.
 *
 * An earlier version implemented If-None-Match against the published baseline
 * and returned 304 BEFORE consulting isQuarterStart(). That meant on
 * Jan/Apr/Jul/Oct a conditional request could skip the quarterly audit
 * entirely — the single day the cron must work was the day it could silently
 * no-op. Customers pay for that audit.
 *
 * This test is static (source-level) plus live behavioural checks, because the
 * strongest statement we can make about a job trigger is that it always runs.
 * Run: node test/quarterly-guard.js
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src", "app", "api", "quarterly-recheck", "route.ts");

// Load CRON_SECRET from the local secrets file (never from git, never echoed)
// so the authorized branch is genuinely exercised rather than skipped. The
// value is read into the child env only and is never printed.
function loadCronSecret() {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
  const candidates = [
    path.join(ROOT, "..", ".secrets", "vercel-cron-secret.txt"),
    path.join(ROOT, ".secrets", "vercel-cron-secret.txt"),
  ];
  for (const c of candidates) {
    try {
      const raw = fs.readFileSync(c, "utf8");
      // The file is a human-readable note plus the secret on its own line.
      // Pick the first line that looks like a bare credential token:
      // no spaces, and long enough to not be prose.
      for (const line of raw.split(/\r?\n/)) {
        const v = line.trim();
        if (!v || /\s/.test(v)) continue;
        if (v.startsWith("#") || v.startsWith("//")) continue;
        if (v.length >= 20) return v;
      }
    } catch {}
  }
  return null;
}

let failures = 0;
function check(label, cond, detail) {
  if (!cond) {
    failures++;
    console.log("  FAIL  " + label + (detail ? "  " + detail : ""));
  } else {
    console.log("  ok    " + label + (detail ? "  " + detail : ""));
  }
}

console.log("\nSource-level guards (route.ts)");
{
  const src = fs.readFileSync(SRC, "utf8");

  // Strip line and block comments first. The route documents *why* caching was
  // removed, and that explanation legitimately names If-None-Match / 304 /
  // ETag — a naive substring scan would flag its own comments and be useless.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    // also drop trailing line comments on code lines
    .replace(/\/\/.*$/gm, " ");

  check("no If-None-Match handling in code", !/if-none-match/i.test(code));
  check("no 304 response in code", !/\b304\b/.test(code));
  check("no ETag construction in code", !/etag/i.test(code));

  // The ordering bug specifically: a 304 short-circuit must not exist before
  // the quarter-start decision. Confirmed by the absence of any early return
  // between the auth block and isQuarterStart.
  const authIdx = src.indexOf("unauthorized");
  const quarterIdx = src.indexOf("isQuarterStart(now)");
  check("auth block precedes quarter check", authIdx > -1 && quarterIdx > authIdx,
    "auth@" + authIdx + " quarter@" + quarterIdx);
  const between = src.slice(authIdx, quarterIdx);
  check("no early return between auth and quarter check",
    !/return new NextResponse\(null/.test(between));

  // Sanity: the stripping itself works, so the guards above are meaningful.
  check("comment stripper sees real code", /NextResponse\.json/.test(code) && !/\/\//.test(code));
}

// Behavioural check against a real server, if a build is present.
const BUILD_PRESENT = fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"));
if (!BUILD_PRESENT) {
  console.log("\n  skip  behavioural checks (no .next build; run npm run build first)");
} else {
  const PORT = 3119;
  const BASE = `http://127.0.0.1:${PORT}`;
  const srv = spawn(process.execPath, [
    path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT),
  ], {
    cwd: ROOT,
    env: { ...process.env, CRON_SECRET: process.env.CRON_SECRET || loadCronSecret() || "" },
    stdio: "ignore",
  });

  (async () => {
    for (let i = 0; i < 40; i++) {
      try { await fetch(BASE + "/"); break; } catch { await new Promise((r) => setTimeout(r, 1000)); }
    }
    try {
      console.log("\nBehavioural guards (live server)");

      // Without CRON_SECRET the endpoint deliberately disables itself and
      // returns 503. That is the fail-closed behaviour we want, and it is
      // emphatically NOT a 304, so it satisfies this guard too.
      const secret = loadCronSecret();
      if (!secret) {
        const r = await fetch(BASE + "/api/quarterly-recheck", {
          headers: { "if-none-match": '"anything"' },
        });
        check("no CRON_SECRET -> 503 fail-closed, never 304", r.status === 503, String(r.status));
        const body = await r.json().catch(() => ({}));
        check("503 body names the missing secret", /CRON_SECRET/.test(JSON.stringify(body)),
          JSON.stringify(body));
      } else {
        // Wrong/missing bearer must be 401 even when a conditional header is
        // present. Never 304: auth is decided before anything else.
        const un = await fetch(BASE + "/api/quarterly-recheck", {
          headers: { "if-none-match": '"2026-Q1|example.com:35:2026-Q3"' },
        });
        check("unauthorized + If-None-Match -> 401, not 304", un.status === 401, String(un.status));
        check("401 body says unauthorized",
          /unauthorized/.test(await un.text()));

        // Authorized force run must execute and return JSON with no ETag.
        const r = await fetch(BASE + "/api/quarterly-recheck?force=1", {
          headers: { authorization: `Bearer ${secret}` },
        });
        check("force=1 -> 200", r.status === 200, String(r.status));
        const etag = r.headers.get("etag");
        check("no ETag header on audit result", !etag, String(etag));
        const j = await r.json().catch(() => null);
        check("force run reports a quarter + ok", j?.ok === true && typeof j?.quarter === "string",
          JSON.stringify({ ok: j?.ok, quarter: j?.quarter }));

        // Feed back a stale conditional header: must still run, not 304.
        const again = await fetch(BASE + "/api/quarterly-recheck?force=1", {
          headers: { authorization: `Bearer ${secret}`, "if-none-match": '"2026-Q1|example.com:35:2026-Q3"' },
        });
        check("conditional header does NOT produce 304", again.status !== 304, String(again.status));
        check("conditional header still runs the audit", again.status === 200, String(again.status));

        // Non-forced run on a non-quarter day must still return a verdict
        // (ran:false), never a 304. This is the exact path the old code
        // could short-circuit.
        const nf = await fetch(BASE + "/api/quarterly-recheck", {
          headers: { authorization: `Bearer ${secret}`, "if-none-match": '"stale"' },
        });
        check("non-forced + conditional -> 200 verdict, not 304", nf.status === 200, String(nf.status));
        const nfJson = await nf.json().catch(() => null);
        check("non-forced verdict has a ran boolean",
          typeof nfJson?.ran === "boolean", JSON.stringify(nfJson)?.slice(0, 80));
      }
    } catch (err) {
      failures++;
      console.log("  FAIL  harness threw: " + err.message);
    }

    // Wait for the server to actually die before exiting. Calling
    // process.exit() while the child's handle is still closing trips a libuv
    // assertion on Windows (UV_HANDLE_CLOSING) that aborts node and, because
    // this runs inside `npm test`, silently truncates the rest of the suite.
    const died = new Promise((resolve) => {
      if (srv.exitCode !== null || srv.signalCode !== null) return resolve();
      srv.once("exit", resolve);
      srv.kill();
      setTimeout(() => { try { srv.kill("SIGKILL"); } catch {} resolve(); }, 4000);
    });

    await died;
    console.log(failures === 0 ? "\nALL QUARTERLY GUARD CHECKS PASSED\n" : "\n" + failures + " FAILURES\n");
    process.exitCode = failures === 0 ? 0 : 1;
  })();
}

// If no build existed we never reached the async IIFE, so decide here.
if (!BUILD_PRESENT) {
  console.log(failures === 0 ? "\nALL QUARTERLY GUARD CHECKS PASSED\n" : "\n" + failures + " FAILURES\n");
  process.exit(failures === 0 ? 0 : 1);
}
