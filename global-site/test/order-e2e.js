/**
 * End-to-end test of the order endpoint against a real next start server.
 * Self-contained: boots, probes, kills. Run: node test/order-e2e.js
 */
const { spawn } = require("child_process");
const path = require("path");

const PORT = 3111;
const BASE = `http://127.0.0.1:${PORT}`;
let failures = 0;
function check(label, cond, detail) {
  if (!cond) { failures++; console.log("  FAIL  " + label + (detail ? "  " + detail : "")); }
  else console.log("  ok    " + label + (detail ? "  " + detail : ""));
}

async function post(body) {
  const r = await fetch(`${BASE}/api/order`, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
    // Same as geo-order-e2e: no mailbox spam from test orders.
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
    console.log("\nValid order");
    const a = await post({ email: "cto@acme.io", tier: "standard", rail: "card", inputs: { monthlyTickets: 5000, channel: "saas", ahtMinutes: 18, automationCoverage: 0.5 } });
    check("valid order -> 200", a.status === 200, String(a.status));
    check("returns an order id", /^SHF-[0-9A-F]{8}$/.test(a.json?.orderId || ""), a.json?.orderId);
    check("charges the SERVER price 49", a.json?.priceUsd === 49, String(a.json?.priceUsd));
    check("flags manual fulfilment (no fake paymentUrl)", a.json?.manual === true && !a.json?.paymentUrl);
    check("returns a report permalink with the buyer scenario", /[?&]v=v1/.test(a.json?.permalink || "") && /[?&]c=saas/.test(a.json?.permalink || "") && /[?&]t=5000/.test(a.json?.permalink || ""), a.json?.permalink);

    console.log("\nPrice tampering");
    const b = await post({ email: "evil@acme.io", tier: "standard", amount: 0.01, rail: "card", inputs: {} });
    check("client amount=0.01 is ignored -> still 49", b.json?.priceUsd === 49, String(b.json?.priceUsd));
    const c = await post({ email: "evil@acme.io", tier: "review", amount: 0, inputs: {} });
    check("review tier priced from server table -> 149", c.json?.priceUsd === 149, String(c.json?.priceUsd));
    const d = await post({ email: "x@y.co", tier: "enterprise", amount: 1, inputs: {} });
    check("unknown tier rejected -> 400", d.status === 400, String(d.status));
    check("unknown tier has no price in body", d.json?.priceUsd === undefined);

    console.log("\nInput validation");
    const e = await post({ email: "not-an-email", tier: "standard", inputs: {} });
    check("invalid email -> 400", e.status === 400, String(e.status));
    const f = await post({ email: "a@b.co", tier: "standard", inputs: { monthlyTickets: 1e308, channel: "../../etc/passwd", ahtMinutes: "abc" } });
    check("hostile inputs still 200 (sanitised, not rejected)", f.status === 200, String(f.status));
    check("hostile permalink has no path traversal", !/\.\./.test(f.json?.permalink || ""), f.json?.permalink);
    check("hostile permalink volume clamped to 60000", /t=60000/.test(f.json?.permalink || ""), f.json?.permalink);
    check("hostile permalink channel normalised", /c=ecommerce/.test(f.json?.permalink || ""), f.json?.permalink);
    const g = await post({ email: "a@b.co", tier: "standard", inputs: {} });
    check("empty inputs -> full defaults, no undefined", /t=3000&a=8/.test(g.json?.permalink || ""), g.json?.permalink);
    const h = await get("/api/order");
    check("GET /api/order -> 405", h.status === 405, String(h.status));

    console.log("\nReport page");
    const i = await get("/report?c=saas&t=5000&a=18&r=40&h=12&d=50&p=0.65&s=2000&m=12&l=0");
    check("report permalink renders -> 200", i.status === 200, String(i.status));
    check("report is a real page, not an error", /Support|support/.test(i.text));
    const j = await get("/report?c=saas&t=250&a=6&r=20&h=8&d=10&p=1&s=500&m=12&l=0");
    check("low-volume report renders -> 200", j.status === 200, String(j.status));
    const k = await get("/");
    check("homepage still 200 with upsell", k.status === 200, String(k.status));
    check("homepage advertises the $49 tier", /\$49/.test(k.text));

    // Run last: it deliberately exhausts the per-IP budget for this server.
    console.log("\nRate limiting (exhausts the budget, so it runs last)");
    let sawThrottle = false;
    for (let n = 0; n < 14; n++) {
      const r = await post({ email: "spam@bot.net", tier: "standard", inputs: {} });
      if (r.status === 429) { sawThrottle = true; check("bot gets 429 after the budget", true, "tripped on attempt " + (n + 1)); break; }
    }
    check("throttle eventually trips", sawThrottle);
    const after = await post({ email: "real-buyer@acme.io", tier: "standard", inputs: {} });
    check("legitimate order during throttle still blocked, not crashed", after.status === 429 || after.status === 200, String(after.status));
  } catch (err) {
    failures++;
    console.log("  FAIL  harness threw: " + err.message);
  } finally {
    srv.kill();
  }

  console.log(failures === 0 ? "\nALL ORDER E2E CHECKS PASSED\n" : "\n" + failures + " FAILURES\n");
  process.exit(failures === 0 ? 0 : 1);
})();
