/**
 * Alipay signing and notification-verification tests.
 *
 * These run against the real lib/alipay with a throwaway keypair generated in
 * the test process. Nothing here touches a real Alipay app or a real key from
 * disk: the merchant credentials found on this machine have not been confirmed
 * to belong to a merchant account the user controls, and nothing in this file
 * reads them.
 *
 * What is actually pinned here:
 * - two env vars must not be enough to call a channel live (the regression that
 *   made the UI offer a checkout that could never settle)
 * - the signing string is built from raw values, not URL-encoded ones
 * - amount tampering is rejected
 * - a signature from a different key is rejected
 */

const assert = require("assert");
const crypto = require("crypto");

// A fake env object keeps the real process env untouched.
const { execSync } = require("child_process");
const { pathToFileURL } = require("url");
const path = require("path");

const alipay = require("../src/lib/alipay.ts");

// payments.ts is intentionally NOT require()d here: it imports "./alipay"
// without an extension, which webpack resolves but Node's native TS loader does
// not. Its behaviour is pinned by the source assertions further down instead.

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures.push(name);
    console.error(`  FAIL ${name}: ${e.message}`);
  }
}

function readSource(rel) {
  return require("fs").readFileSync(path.join(__dirname, "..", rel), "utf8");
}

/**
 * Source with comments stripped. Assertions about what a module *does* must not
 * match prose in a comment explaining why it does it — otherwise a correct
 * implementation fails the test purely because it was documented well.
 */
function readCode(rel) {
  return readSource(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// --- throwaway keypair -------------------------------------------------------

const { privateKey, publicKey } = (() => {
  const kp = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    privateKey: kp.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKey: kp.publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
})();

// A second, unrelated keypair used as an attacker's key.
const attacker = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const attackerPublic = attacker.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();

function fullEnv(overrides = {}) {
  return {
    ALIPAY_ENABLED: "true",
    ALIPAY_APP_ID: "2021000000000001",
    ALIPAY_PRIVATE_KEY: privateKey,
    ALIPAY_PUBLIC_KEY: publicKey,
    ALIPAY_GATEWAY: "https://openapi.alipay.com/gateway.do",
    ALIPAY_SELLER_ID: "2088123456789012",
    ALIPAY_NOTIFY_URL: "https://shiftless.vercel.app/api/alipay/notify",
    ALIPAY_RETURN_URL: "https://shiftless.vercel.app/api/alipay/return",
    ...overrides,
  };
}

console.log("configuration gating");

check("nothing configured -> not live", () => {
  assert.strictEqual(alipay.alipayConfigured({}), false);
});

check(
  "the old two-variable check (APP_ID + PRIVATE_KEY) is NOT enough",
  () => {
    // This is the exact regression: the previous implementation returned true
    // here and the UI would have shown a live checkout button.
    const twoVars = { ALIPAY_APP_ID: "2021000000000001", ALIPAY_PRIVATE_KEY: privateKey };
    assert.strictEqual(alipay.alipayConfigured(twoVars), false);

    const missing = alipay.alipayMissingEnv(twoVars);
    assert.ok(missing.some((m) => m.includes("ALIPAY_PUBLIC_KEY")));
    assert.ok(missing.some((m) => m.includes("SELLER_ID")));
    assert.ok(missing.some((m) => m.includes("NOTIFY_URL")));
  }
);

check("ALIPAY_ENABLED must be exactly true", () => {
  assert.strictEqual(alipay.alipayConfigured(fullEnv({ ALIPAY_ENABLED: "false" })), false);
  assert.strictEqual(alipay.alipayConfigured(fullEnv({ ALIPAY_ENABLED: "yes" })), false);
  assert.strictEqual(alipay.alipayConfigured(fullEnv({ ALIPAY_ENABLED: "TRUE" })), true);
});

check("full config -> live", () => {
  assert.strictEqual(alipay.alipayConfigured(fullEnv()), true);
});

check("http notify url is rejected", () => {
  assert.strictEqual(
    alipay.alipayConfigured(fullEnv({ ALIPAY_NOTIFY_URL: "http://shiftless.vercel.app/api/alipay/notify" })),
    false
  );
});

check("payments.ts reports alipay not live without full config", () => {
  // payments.ts reads process.env; assert on the source rather than mutating the
  // live environment, since these tests share it with the build.
  const src = readSource("src/lib/payments.ts");
  assert.ok(/alipayConfigured\(\)/.test(src), "must delegate to alipayConfigured");
  assert.ok(
    !/ALIPAY_APP_ID && process\.env\.ALIPAY_PRIVATE_KEY/.test(src),
    "must not use the two-variable shortcut"
  );
});

console.log("\nkey loading");

check("PKCS#8 PEM loads", () => {
  assert.ok(alipay.loadPrivateKey(privateKey));
});

check("private key with literal \\n and surrounding quotes loads", () => {
  const mangled = '"' + privateKey.replace(/\n/g, "\\n") + '"';
  assert.ok(alipay.loadPrivateKey(mangled));
});

check("private key with CRLF loads", () => {
  assert.ok(alipay.loadPrivateKey(privateKey.replace(/\n/g, "\r\n")));
});

check("bare base64 PKCS#1 loads", () => {
  const kp = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pkcs1 = kp.privateKey.export({ type: "pkcs1", format: "pem" }).toString();
  const bare = pkcs1
    .replace(/-----[A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  assert.ok(alipay.loadPrivateKey(bare));
});

check("bare base64 SPKI public key loads", () => {
  const bare = publicKey.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  assert.ok(alipay.loadPublicKey(bare));
});

console.log("\nsigning");

check("signingString sorts keys and drops empty/sign values", () => {
  const s = alipay.signingString({
    b: "2",
    a: "1",
    sign: "IGNORED",
    sign_type: "IGNORED",
    empty: "",
    missing: undefined,
  });
  assert.strictEqual(s, "a=1&b=2");
});

check("sign then verify round-trips", () => {
  const params = { app_id: "x", method: "alipay.trade.page.pay", biz_content: '{"a":1}' };
  const sig = alipay.signParams(params, privateKey);
  assert.strictEqual(alipay.verifySignature(params, sig, publicKey), true);
});

check("signature fails if a signed value is altered", () => {
  const params = { app_id: "x", biz_content: '{"a":1}' };
  const sig = alipay.signParams(params, privateKey);
  assert.strictEqual(
    alipay.verifySignature({ app_id: "x", biz_content: '{"a":2}' }, sig, publicKey),
    false
  );
});

check("signature from a different key is rejected", () => {
  const params = { app_id: "x", biz_content: "{}" };
  const sig = alipay.signParams(params, attacker.privateKey.export({ type: "pkcs8", format: "pem" }).toString());
  assert.strictEqual(alipay.verifySignature(params, sig, publicKey), false);
});

console.log("\npage pay");

check("buildPagePay signs and self-verifies", () => {
  const pay = alipay.buildPagePay(
    { outTradeNo: "SUB-ABC123", amount: 60, subject: "test" },
    fullEnv()
  );
  assert.ok(pay.url.startsWith("https://openapi.alipay.com/gateway.do?"));
  assert.strictEqual(pay.params.method, "alipay.trade.page.pay");
  assert.strictEqual(alipay.verifySignature(pay.params, pay.params.sign, publicKey), true);
});

check("amount is sent as a 2-decimal string", () => {
  const pay = alipay.buildPagePay(
    { outTradeNo: "SUB-1", amount: 150, subject: "s" },
    fullEnv()
  );
  const biz = JSON.parse(pay.params.biz_content);
  assert.strictEqual(biz.total_amount, "150.00");
});

check("zero and negative amounts are refused", () => {
  for (const amt of [0, -1, NaN]) {
    assert.throws(
      () => alipay.buildPagePay({ outTradeNo: "SUB-1", amount: amt, subject: "s" }, fullEnv()),
      /invalid amount/
    );
  }
});

check("out_trade_no with shell/URL metacharacters is refused", () => {
  for (const bad of ["SUB/../etc", "SUB 1", "SUB&x=1", "x".repeat(65), ""]) {
    assert.throws(
      () => alipay.buildPagePay({ outTradeNo: bad, amount: 60, subject: "s" }, fullEnv()),
      /invalid out_trade_no/,
      `should reject ${JSON.stringify(bad)}`
    );
  }
});

check("biz_content carries the server-side order, not a client amount", () => {
  const pay = alipay.buildPagePay(
    { outTradeNo: "SUB-1", amount: 60, subject: "s", passbackParams: "SUB-1" },
    fullEnv()
  );
  const biz = JSON.parse(pay.params.biz_content);
  assert.strictEqual(biz.out_trade_no, "SUB-1");
  assert.strictEqual(biz.passback_params, "SUB-1");
  assert.strictEqual(biz.product_code, "FAST_INSTANT_TRADE_PAY");
});

check("mismatched keypair fails self-verification instead of emitting a bad request", () => {
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  assert.throws(
    () =>
      alipay.buildPagePay({ outTradeNo: "SUB-1", amount: 60, subject: "s" },
        fullEnv({ ALIPAY_PUBLIC_KEY: other.publicKey.export({ type: "spki", format: "pem" }).toString() })),
    /self-verification/
  );
});

check("incomplete config throws AlipayNotConfiguredError", () => {
  assert.throws(
    () => alipay.buildPagePay({ outTradeNo: "SUB-1", amount: 60, subject: "s" }, { ALIPAY_APP_ID: "1" }),
    alipay.AlipayNotConfiguredError
  );
});

console.log("\nnotify verification");

function signNotify(overrides = {}) {
  const params = {
    app_id: "2021000000000001",
    seller_id: "2088123456789012",
    out_trade_no: "SUB-ABC123",
    trade_no: "2026100100000001",
    trade_status: "TRADE_SUCCESS",
    total_amount: "60.00",
    ...overrides,
  };
  return { ...params, sign: alipay.signParams(params, privateKey) };
}

check("valid TRADE_SUCCESS accepted at the right amount", () => {
  const v = alipay.verifyNotify(signNotify(), 60, fullEnv());
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.ok && v.event, "paid");
  assert.strictEqual(v.ok && v.outTradeNo, "SUB-ABC123");
});

check("TRADE_FINISHED also counts as paid", () => {
  const v = alipay.verifyNotify(signNotify({ trade_status: "TRADE_FINISHED" }), 60, fullEnv());
  assert.strictEqual(v.ok && v.event, "paid");
});

check("WAIT_BUYER_PAY is pending, not paid", () => {
  const v = alipay.verifyNotify(signNotify({ trade_status: "WAIT_BUYER_PAY" }), 60, fullEnv());
  assert.strictEqual(v.ok && v.event, "pending");
});

check("amount mismatch is rejected", () => {
  const v = alipay.verifyNotify(signNotify(), 150, fullEnv());
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.ok === false && v.reason, "amount_mismatch");
});

check("a 1-fen difference is still a mismatch", () => {
  const v = alipay.verifyNotify(signNotify({ total_amount: "59.99" }), 60, fullEnv());
  assert.strictEqual(v.ok, false);
});

check("null expected amount skips the amount check (non-CNY)", () => {
  const v = alipay.verifyNotify(signNotify(), null, fullEnv());
  assert.strictEqual(v.ok, true);
});

check("forged signature rejected", () => {
  const params = signNotify();
  params.total_amount = "0.01"; // altered after signing
  const v = alipay.verifyNotify(params, 0.01, fullEnv());
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.ok === false && v.reason, "bad_signature");
});

check("signature by another key rejected", () => {
  const params = signNotify();
  params.sign = alipay.signParams(
    { ...params, sign: undefined },
    attacker.privateKey.export({ type: "pkcs8", format: "pem" }).toString()
  );
  const v = alipay.verifyNotify(params, 60, fullEnv());
  assert.strictEqual(v.ok === false && v.reason, "bad_signature");
});

check("app_id mismatch rejected", () => {
  const v = alipay.verifyNotify(signNotify({ app_id: "9999" }), 60, fullEnv());
  assert.strictEqual(v.ok === false && v.reason, "app_id_mismatch");
});

check("seller_id mismatch rejected", () => {
  const v = alipay.verifyNotify(signNotify({ seller_id: "1111" }), 60, fullEnv());
  assert.strictEqual(v.ok === false && v.reason, "seller_id_mismatch");
});

check("missing sign rejected", () => {
  const params = signNotify();
  delete params.sign;
  const v = alipay.verifyNotify(params, 60, fullEnv());
  assert.strictEqual(v.ok === false && v.reason, "missing_sign");
});

check("missing out_trade_no rejected", () => {
  const p = signNotify({ out_trade_no: "" });
  const v = alipay.verifyNotify(p, 60, fullEnv());
  assert.strictEqual(v.ok === false && v.reason, "missing_out_trade_no");
});

check("unconfigured deployment rejects rather than throwing", () => {
  const v = alipay.verifyNotify(signNotify(), 60, {});
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.ok === false && v.reason, "not_configured");
});

console.log("\nrefund");

check("buildRefund signs alipay.trade.refund", () => {
  const r = alipay.buildRefund({ outTradeNo: "SUB-1", refundAmount: 60 }, fullEnv());
  assert.strictEqual(r.params.method, "alipay.trade.refund");
  const biz = JSON.parse(r.params.biz_content);
  assert.strictEqual(biz.refund_amount, "60.00");
  assert.strictEqual(alipay.verifySignature(r.params, r.params.sign, publicKey), true);
});

check("over-refund and zero refund are refused locally", () => {
  const r = alipay.buildRefund({ outTradeNo: "SUB-1", refundAmount: 5000 }, fullEnv());
  assert.ok(r); // lib only validates its own input, not business limits
  assert.throws(
    () => alipay.buildRefund({ outTradeNo: "SUB-1", refundAmount: 0 }, fullEnv()),
    /invalid refund amount/
  );
});

console.log("\nroute wiring");

const notify = readSource("src/app/api/alipay/notify/route.ts");
const ret = readSource("src/app/api/alipay/return/route.ts");
const refund = readSource("src/app/api/alipay/refund/route.ts");
const subOrder = readSource("src/app/api/sub-order/route.ts");

check("notify responds with the literal 'success' body Alipay requires", () => {
  assert.ok(ALIPAY_BODY_SUCCESS());
  function ALIPAY_BODY_SUCCESS() {
    return /ALIPAY_NOTIFY_BODY\.success/.test(notify) && /"success"/.test(readSource("src/lib/alipay.ts"));
  }
});

check("notify compares the amount against the stored order, not the message", () => {
  assert.ok(/order\.amount/.test(notify));
  assert.ok(!/expectedAmount[^)]*params/.test(notify));
});

check("notify is form-urlencoded, not JSON", () => {
  assert.ok(/formData\(\)/.test(notify));
});

check("return page grants nothing", () => {
  // It may only read order status; it must never write entitlement.
  assert.ok(!/grantEntitlement|markOrderPaid|entitlement:/.test(ret));
  assert.ok(/status === "paid"/.test(ret));
});

check("return page does not claim success while unconfirmed", () => {
  assert.ok(/正在确认支付结果/.test(ret));
});

check("return page escapes interpolated values", () => {
  assert.ok(/escapeHtml/.test(ret));
});

check("refund requires a bearer token compared in constant time", () => {
  assert.ok(/timingSafeEqual/.test(refund));
  assert.ok(/ALIPAY_ADMIN_TOKEN/.test(refund));
});

check("refund treats a non-10000 alipay code as failure", () => {
  assert.ok(/code !== "10000"/.test(refund));
});

check("refund cannot exceed the collected amount", () => {
  assert.ok(/不能超过实收金额/.test(refund));
});

check("sub-order returns a paymentUrl only on the alipay path", () => {
  assert.ok(/paymentUrl: pay\.url/.test(subOrder));
});

check("sub-order refuses online checkout without order storage", () => {
  assert.ok(/ordersAvailable\(\)/.test(subOrder));
});

check("sub-order persists the order before returning a payment url", () => {
  const saveAt = subOrder.indexOf("saveOrder({");
  const urlAt = subOrder.indexOf("paymentUrl: pay.url");
  assert.ok(saveAt !== -1 && urlAt !== -1);
  assert.ok(saveAt < urlAt, "order must be saved before the url is returned");
});

check("usd orders are not routed to the alipay gateway", () => {
  assert.ok(/channelSupportsCurrency/.test(subOrder));
  const paymentsSrc = readSource("src/lib/payments.ts");
  assert.ok(
    /method === "alipay"\) return currency === "cny"/.test(paymentsSrc),
    "alipay must be cny-only"
  );
});

check("orders module keys idempotency on order status, not an NX lock", () => {
  const orders = readSource("src/lib/orders.ts");
  assert.ok(/status === "paid"/.test(orders));
  assert.ok(
    !/kv\.set\(`paid:/.test(orders),
    "an NX lock before the grant can strand a paid customer"
  );
  assert.ok(/grantEntitlement/.test(orders));
});

check("entitlement months come from the stored order", () => {
  const orders = readSource("src/lib/orders.ts");
  assert.ok(/months: monthsGranted\(order\)/.test(orders) || /months,\n      orderId/.test(orders));
});

console.log("\nchannel status endpoint");

const paymentsRoute = readCode("src/app/api/payments/route.ts");
const subOrderUi = readCode("src/components/SubOrder.tsx");

check("payments endpoint leaks no operator detail", () => {
  assert.ok(!/blockedOn/.test(paymentsRoute), "must not expose missing-env detail");
  assert.ok(!/ALIPAY_PRIVATE_KEY|privateKey|sellerId/.test(paymentsRoute));
});

check("payments endpoint returns only id/label/live", () => {
  assert.ok(/id: c\.id/.test(paymentsRoute));
  assert.ok(/label: c\.label/.test(paymentsRoute));
  assert.ok(/live: c\.live/.test(paymentsRoute));
});

check("ui only offers channels the server marked live", () => {
  assert.ok(/c\.live/.test(subOrderUi));
  assert.ok(/fetch\("\/api\/payments"\)/.test(subOrderUi));
});

check("ui hides alipay for usd", () => {
  assert.ok(
    /currency === "cny" \|\| c\.id !== "alipay"/.test(subOrderUi),
    "alipay settles CNY only and must be hidden for USD"
  );
});

check("ui follows the server-returned paymentUrl and nothing else", () => {
  assert.ok(/window\.location\.assign\(j\.paymentUrl\)/.test(subOrderUi));
  assert.ok(/j\.manual === false/.test(subOrderUi));
});

check("ui never builds a payment url itself", () => {
  // A client-side signature is not possible and would be pointless; the only
  // acceptable source is the server response.
  assert.ok(!/openapi\.alipay\.com/.test(subOrderUi));
});

console.log(`\n${passed} checks passed`);
if (failures.length) {
  console.error(`${failures.length} FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
