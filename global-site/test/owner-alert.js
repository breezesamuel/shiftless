/**
 * Owner-alert regression tests.
 *
 * The failure this guards: leads and orders were stored durably (Blob) but
 * nobody was ever emailed about them, so every captured email sat invisible
 * until someone remembered to open the export. This pins down the new
 * contract — every contact/money path calls sendOwnerAlert, wraps it so a mail
 * outage can never fail the submission, and gets a result instead of a throw.
 */

process.env.KV_REST_API_URL = "";
process.env.KV_REST_API_TOKEN = "";
process.env.SMTP_HOST = "";
process.env.SMTP_PORT = "";
process.env.SMTP_USER = "";
process.env.SMTP_AUTH_CODE = "";
process.env.EMAIL_FROM = "";
delete process.env.OWNER_ALERT_EMAIL;
delete process.env.LEAD_NOTIFY_EMAIL;

const assert = require("assert");
const fs = require("fs");
const path = require("path");
let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`  FAIL ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`  FAIL ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}
function readSource(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

(async () => {
  const mail = require("../src/lib/mail.ts");

  check("bareAddress strips a display-name wrapper", () => {
    assert.strictEqual(mail.bareAddress("Shiftless <hi@example.com>"), "hi@example.com");
    assert.strictEqual(mail.bareAddress("hi@example.com"), "hi@example.com");
  });

  check("ownerAlertAddress is null with nothing set", () => {
    assert.strictEqual(mail.ownerAlertAddress(), null);
  });

  check("ownerAlertAddress falls back to SMTP_USER", () => {
    process.env.SMTP_USER = "ops@example.com";
    assert.strictEqual(mail.ownerAlertAddress(), "ops@example.com");
    process.env.SMTP_USER = "";
  });

  check("ownerAlertAddress prefers OWNER_ALERT_EMAIL over SMTP_USER", () => {
    process.env.OWNER_ALERT_EMAIL = "Ops <ops@example.com>";
    process.env.SMTP_USER = "460123249@qq.com";
    assert.strictEqual(mail.ownerAlertAddress(), "ops@example.com");
    delete process.env.OWNER_ALERT_EMAIL;
    process.env.SMTP_USER = "";
  });

  check("ownerAlertConfigured is false without SMTP", () => {
    assert.strictEqual(mail.ownerAlertConfigured(), false);
  });

  checkAsync("sendOwnerAlert returns a result instead of throwing without SMTP", async () => {
    const r = await mail.sendOwnerAlert("subject", "body");
    assert.deepStrictEqual(r, { sent: false, reason: "smtp_not_configured" });
  });

  checkAsync("sendMagicLink returns a result instead of throwing without SMTP", async () => {
    const r = await mail.sendMagicLink("a@b.com", "https://shiftless.vercel.app");
    assert.deepStrictEqual(r, { sent: false, reason: "smtp_not_configured" });
  });

  const mailSource = readSource("src/lib/mail.ts");
  check("sendOwnerAlert recipient comes from env, never a hardcoded address", () => {
    assert.ok(!/to:\s*["'](460123249|supi24)/.test(mailSource));
    assert.ok(/process\.env\.OWNER_ALERT_EMAIL/.test(mailSource));
  });

  console.log("routes must notify the owner on every contact/money event");

  const lead = readSource("src/app/api/lead/route.ts");
  const order = readSource("src/app/api/order/route.ts");
  const geo = readSource("src/app/api/geo-order/route.ts");
  const sub = readSource("src/app/api/sub-order/route.ts");
  const paypal = readSource("src/app/api/paypal/return/route.ts");
  const health = readSource("src/app/api/health/route.ts");

  for (const [name, src] of [
    ["lead", lead],
    ["order", order],
    ["geo-order", geo],
    ["sub-order", sub],
    ["paypal/return", paypal],
  ]) {
    check(`${name} calls sendOwnerAlert inside try/catch`, () => {
      const i = src.indexOf("sendOwnerAlert(");
      assert.ok(i !== -1, "sendOwnerAlert not called");
      assert.ok(/try\s*\{/.test(src.slice(0, i)), "call is not inside a try block");
    });
    check(`${name} logs an alert failure instead of rethrowing`, () => {
      assert.ok(/ALERT-FAIL/.test(src), "alert failure is not logged");
    });
  }

  check("lead route reports alerted on the response", () => {
    assert.ok(/alerted/.test(lead));
  });

  check("health reports ownerAlertConfigured and how to set it", () => {
    assert.ok(/ownerAlertConfigured/.test(health));
    assert.ok(/OWNER_ALERT_EMAIL/.test(health));
  });

  console.log(`\n${passed} owner-alert checks passed`);
})();