/**
 * PayPal checkout regression tests (all offline — fetch is stubbed).
 *
 * Two invariants:
 * 1. Without credentials the order route must not produce a paymentUrl, and
 *    createOrder must never throw into the request — a broken payment channel
 *    degrades to manual fulfilment, it does not 500 the checkout.
 * 2. The amount charged comes from the server's price table, never from the
 *    request body, and the capture result comes from PayPal's response, never
 *    from the return URL's query string.
 */

const assert = require("assert");
let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ok  ${name}`);
    })
    .catch((e) => {
      console.error(`  FAIL ${name}: ${e.message}`);
      process.exitCode = 1;
    });
}

function readSource(rel) {
  return require("fs").readFileSync(require("path").join(__dirname, "..", rel), "utf8");
}

const realFetch = globalThis.fetch;

console.log("paypal checkout (was: USD orders were manual-only with no live path)");

(async () => {
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  delete process.env.PAYPAL_MODE;
  const paypal = require("../src/lib/paypal.ts");

  await check("unconfigured without env", () => {
    assert.strictEqual(paypal.paypalConfigured(), false);
  });

  await check("createOrder returns null instead of throwing when unconfigured", async () => {
    globalThis.fetch = async () => {
      throw new Error("network");
    };
    const r = await paypal.createOrder({
      amount: "49.00",
      orderId: "SHF-TEST",
      description: "test",
      returnUrl: "https://shiftless.vercel.app/api/paypal/return",
      cancelUrl: "https://shiftless.vercel.app/",
    });
    assert.strictEqual(r, null);
  });

  process.env.PAYPAL_CLIENT_ID = "test-client";
  process.env.PAYPAL_CLIENT_SECRET = "test-secret";

  await check("configured with env", () => {
    assert.strictEqual(paypal.paypalConfigured(), true);
  });

  await check("createOrder posts the server amount and returns the approve link", async () => {
    let captured;
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.endsWith("/v1/oauth2/token")) {
        return { ok: true, json: async () => ({ access_token: "tok", expires_in: 3200 }) };
      }
      captured = { url: u, body: JSON.parse(opts.body), headers: opts.headers };
      return {
        ok: true,
        json: async () => ({
          id: "PAYPAL123",
          links: [
            { rel: "self", href: "https://api-m.paypal.com/v2/checkout/orders/PAYPAL123" },
            { rel: "approve", href: "https://www.paypal.com/checkoutnow?token=PAYPAL123" },
          ],
        }),
      };
    };
    const r = await paypal.createOrder({
      amount: "49.00",
      orderId: "SHF-ABC12345",
      description: "Shiftless standard report",
      returnUrl: "https://shiftless.vercel.app/api/paypal/return?orderId=SHF-ABC12345",
      cancelUrl: "https://shiftless.vercel.app/",
    });
    assert.strictEqual(r.id, "PAYPAL123");
    assert.ok(r.approveUrl.includes("paypal.com"));
    const order = captured.body;
    assert.strictEqual(order.purchase_units[0].amount.value, "49.00");
    assert.strictEqual(order.purchase_units[0].amount.currency_code, "USD");
    assert.strictEqual(order.purchase_units[0].invoice_id, "SHF-ABC12345");
    assert.strictEqual(order.intent, "CAPTURE");
  });

  await check("captureOrder rejects a malformed order id before any network call", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      throw new Error("should not be reached");
    };
    const r = await paypal.captureOrder("../../etc/passwd");
    assert.strictEqual(r, null);
    assert.strictEqual(called, false);
  });

  await check("captureOrder reports PayPal's amount, not anything from a URL", async () => {
    globalThis.fetch = async (url, opts) => {
      if (String(url).endsWith("/v1/oauth2/token")) {
        return { ok: true, json: async () => ({ access_token: "tok", expires_in: 3200 }) };
      }
      return {
        ok: true,
        json: async () => ({
          id: "PAYPAL123",
          status: "COMPLETED",
          payer: { email_address: "buyer@example.com" },
          purchase_units: [
            { payments: { captures: [{ amount: { value: "49.00", currency_code: "USD" } }] } },
          ],
        }),
      };
    };
    const r = await paypal.captureOrder("PAYPAL123");
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.amount, "49.00");
    assert.strictEqual(r.currency, "USD");
    assert.strictEqual(r.payerEmail, "buyer@example.com");
  });

  globalThis.fetch = realFetch;
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;

  const orderRoute = readSource("src/app/api/order/route.ts");
  const returnRoute = readSource("src/app/api/paypal/return/route.ts");

  await check("order route prices from its own table, never the request body", () => {
    assert.ok(!/body\.(amount|price)/.test(orderRoute), "client amount read found");
    assert.ok(/const price = PRICES\[tier\]/.test(orderRoute), "server price lookup missing");
  });

  await check("order route only offers checkout when PayPal is configured", () => {
    assert.ok(/paypalConfigured\(\)/.test(orderRoute), "configured guard missing");
    assert.ok(/manual: !paymentUrl/.test(orderRoute), "manual fallback missing");
  });

  await check("return route logs the capture durably (stdout + webhook)", () => {
    assert.ok(/\[ORDER\]/.test(returnRoute), "[ORDER] log line missing");
    assert.ok(/ORDER_WEBHOOK_URL/.test(returnRoute), "webhook fire missing");
  });

  await check("return route only reflects its own report URLs", () => {
    assert.ok(/startsWith\(`\$\{SITE\}\/report\?`\)/.test(returnRoute), "permalink allow-list missing");
  });

  console.log(`\n${passed} paypal checks passed`);
})();
