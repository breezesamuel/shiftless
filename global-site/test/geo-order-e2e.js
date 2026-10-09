/**
 * End-to-end test of the GEO audit order endpoint against a real next start
 * server. Boots, probes, kills. Run: node test/geo-order-e2e.js
 * Mirrors order-e2e.js but targets /api/geo-order and the /geo page.
 *
 * Each test section uses its own spoofed x-forwarded-for so the per-IP rate
 * limiter (6/h) does not make validation checks throw 429 before the throttle
 * test exhausts a dedicated budget last.
 */
const { spawn } = require("child_process");
const path = require("path");

const PORT = 3112;
const BASE = `http://127.0.0.1:${PORT}`;
let failures = 0;
function check(label, cond, detail) {
  if (!cond) { failures++; console.log("  FAIL  " + label + (detail ? "  " + detail : "")); }
  else console.log("  ok    " + label + (detail ? "  " + detail : ""));
}

async function post(body, ip) {
  const r = await fetch(`${BASE}/api/geo-order`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip || "203.0.113.9" },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
async function postSub(body, ip) {
  const r = await fetch(`${BASE}/api/sub-order`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip || "203.0.113.9" },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
async function get(pathname) {
  const r = await fetch(BASE + pathname);
  return { status: r.status, text: await r.text() };
}

const srv = spawn(process.execPath, [path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)], {
  cwd: path.join(__dirname, ".."),
  env: {
    ...process.env,
    // Blank SMTP so e2e order submissions cannot fire real owner-alert emails
    // to the operator's mailbox on every test run. Existing env vars win over
    // .env.local, so the spawned server sees no mail transport and the routes
    // respond alerted:false instead of mailing a human.
    SMTP_HOST: "",
    SMTP_PORT: "",
    SMTP_USER: "",
    SMTP_AUTH_CODE: "",
    EMAIL_FROM: "",
    NODE_OPTIONS: "--max-old-space-size=4096",
  },
  stdio: "ignore",
});

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + "/"); break; } catch { await new Promise((r) => setTimeout(r, 1000)); }
  }

  try {
    console.log("\nValid GEO order");
    const a = await post({ email: "ops@saas.io", siteUrl: "https://www.jackyun.com", tier: "report" }, "203.0.113.10");
    check("valid order -> 200", a.status === 200, String(a.status));
    check("returns GEO order id", /^GEO-[0-9A-F]{6,}$/.test(a.json?.orderId || ""), a.json?.orderId);
    check("report tier priced server-side -> 1999", a.json?.priceCny === 1999, String(a.json?.priceCny));
    check("flags manual fulfilment (no paymentUrl)", a.json?.manual === true && !a.json?.paymentUrl);
    check("echoes the site url", a.json?.siteUrl === "https://www.jackyun.com", a.json?.siteUrl);

    console.log("\nPrice tampering");
    const b = await post({ email: "evil@s.io", siteUrl: "https://x.com", tier: "report", priceCny: 1 }, "203.0.113.11");
    check("client amount=1 ignored -> still 1999", b.json?.priceCny === 1999, String(b.json?.priceCny));
    const c = await post({ email: "evil@s.io", siteUrl: "https://x.com", tier: "fix", priceCny: 0 }, "203.0.113.11");
    check("fix tier priced from server table -> 4999", c.json?.priceCny === 4999, String(c.json?.priceCny));
    const d = await post({ email: "evil@s.io", siteUrl: "https://x.com", tier: "enterprise" }, "203.0.113.11");
    check("unknown tier rejected -> 400", d.status === 400, String(d.status));
    const d2 = await post({ email: "evil@s.io", siteUrl: "https://x.com", tier: "subscription", priceCny: 1 }, "203.0.113.11");
    check("subscription tier priced from server table -> 2999", d2.json?.priceCny === 2999, String(d2.json?.priceCny));

    console.log("\nURL validation");
    const e = await post({ email: "a@b.co", siteUrl: "not a url", tier: "report" }, "203.0.113.12");
    check("non-url site -> 400", e.status === 400, String(e.status));
    const f = await post({ email: "a@b.co", siteUrl: "https://evil.com/x?y=1", tier: "report" }, "203.0.113.12");
    check("url with path rejected (root-origin only) -> 400", f.status === 400, String(f.status));
    const g = await post({ email: "a@b.co", siteUrl: "javascript:alert(1)", tier: "report" }, "203.0.113.12");
    check("javascript: scheme rejected -> 400", g.status === 400, String(g.status));

    console.log("\nEmail validation");
    const h = await post({ email: "not-an-email", siteUrl: "https://x.com", tier: "report" }, "203.0.113.13");
    check("invalid email -> 400", h.status === 400, String(h.status));

    console.log("\nPages");
    const i = await get("/geo");
    check("/geo landing -> 200", i.status === 200, String(i.status));
    check("landing shows honest boundary (no ranking promise)", /排名/.test(i.text) && /可复现/.test(i.text));
    check("landing shows both price tiers", /1999/.test(i.text) && /4999/.test(i.text));
    check("landing shows the sample scores", /35\/100/.test(i.text) && /52\/100/.test(i.text));
    const k1 = await get("/geo/samples/jackyun");
    check("jackyun sample page -> 200", k1.status === 200, String(k1.status));
    const k2 = await get("/geo/samples/sellersprite");
    check("sellersprite sample page -> 200", k2.status === 200, String(k2.status));
    const k3 = await get("/geo/subscribe");
    check("subscribe page -> 200", k3.status === 200, String(k3.status));
    check("subscribe page shows CNY prices 60/150/500",
      /60/.test(k3.text) && /150/.test(k3.text) && /500/.test(k3.text));
    check("subscribe page shows USD prices 9.90/25/99",
      /9\.90/.test(k3.text) && /\$25/.test(k3.text) && /\$99/.test(k3.text));
    check("subscribe page shows the 10 free uses", /10\s*次免费|10\s*free/i.test(k3.text));
    check("subscribe page shows all three referral rewards",
      /赠\s*1\s*个月|1\s*month/.test(k3.text) &&
      /3\s*个季度|quarter/.test(k3.text) &&
      /赠\s*1\s*年|a\s*year/.test(k3.text));
    check("subscribe page states stacking rule", /叠加|stack/i.test(k3.text));
    check("subscribe page states honest boundary (no ranking promise)", !/保证.{0,4}排名|排名保证/.test(k3.text));
    check("subscribe page does not fake a live payment channel",
      /开通中|not live|not yet/i.test(k3.text));
    check("subscribe page explains WeChat/Alipay are separate clearing systems",
      /独立.{0,4}清算|互相转入/.test(k3.text));

    const m = await get("/geo");
    check("landing links to subscribe", /href="\/geo\/subscribe"/.test(m.text));
    check("landing mentions free tier", /10\s*次免费|10\s*free/i.test(m.text));

    console.log("\nSubscription endpoint validation");
    const s1 = await postSub({ email: "subs@ex.com", siteUrl: "https://ex.com", plan: "yearly", currency: "cny" }, "203.0.113.100");
    check("sub-order valid -> 200", s1.status === 200, String(s1.status));
    check("sub-order returns SUB id", /^SUB-[0-9A-F]{6,}$/.test(s1.json?.orderId || ""), s1.json?.orderId);
    check("sub-order prices yearly CNY 500", s1.json?.price === 500, String(s1.json?.price));
    check("sub-order months = 12", s1.json?.months === 12, String(s1.json?.months));
    check("sub-order manual/fallback reflects channel status", s1.json?.manual === true || s1.json?.onlineCheckoutAvailable === false);
    const s2 = await postSub({ email: "subs@ex.com", siteUrl: "https://ex.com", plan: "monthly", currency: "usd" }, "203.0.113.101");
    check("sub-order monthly USD 9.9", s2.json?.price === 9.9, String(s2.json?.price));
    const s3 = await postSub({ email: "subs@ex.com", siteUrl: "https://ex.com", plan: "enterprise" }, "203.0.113.102");
    check("sub-order rejects unknown plan -> 400", s3.status === 400, String(s3.status));
    const s4 = await postSub({ email: "bad", siteUrl: "https://ex.com", plan: "yearly" }, "203.0.113.103");
    check("sub-order rejects bad email -> 400", s4.status === 400, String(s4.status));

    console.log("\nMethod guards");
    const l = await get("/api/geo-order");
    check("GET /api/geo-order -> 405", l.status === 405, String(l.status));
    const l2 = await get("/api/sub-order");
    check("GET /api/sub-order -> 405", l2.status === 405, String(l2.status));

    console.log("\nRate limiting (dedicated IP, exhausts its budget, runs last)");
    const spamIp = "198.51.100.77";
    let sawThrottle = false;
    for (let n = 0; n < 10; n++) {
      const r = await post({ email: "spam@bot.net", siteUrl: "https://x.com", tier: "report" }, spamIp);
      if (r.status === 429) { sawThrottle = true; check("bot gets 429 after budget", true, "tripped on attempt " + (n + 1)); break; }
    }
    check("throttle eventually trips", sawThrottle);
    const blocked = await post({ email: "spam2@bot.net", siteUrl: "https://x.com", tier: "report" }, spamIp);
    check("further orders from same IP blocked, not crashed", blocked.status === 429, String(blocked.status));
  } catch (err) {
    failures++;
    console.log("  FAIL  harness threw: " + err.message);
  } finally {
    srv.kill();
  }

  console.log(failures === 0 ? "\nALL GEO-ORDER E2E CHECKS PASSED\n" : "\n" + failures + " FAILURES\n");
  process.exit(failures === 0 ? 0 : 1);
})();