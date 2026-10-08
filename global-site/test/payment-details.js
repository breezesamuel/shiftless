/**
 * Payment-path regression tests.
 *
 * The bug these guard: every order endpoint replied "请按下方支付方式转账…
 * 备注订单号", but no page showed an account to transfer to. The manual path —
 * the only path that can actually collect money today — was a dead end with a
 * reference number and no destination, so an order could be placed and the
 * money never arrive. Separately, Upsell told buyers to "Check your email for
 * payment instructions" when no order email is ever sent, which loses the
 * buyer at the exact moment they have decided to pay.
 */

const assert = require("assert");
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

function readSource(rel) {
  return require("fs").readFileSync(require("path").join(__dirname, "..", rel), "utf8");
}

console.log("payment details (was: order id with nowhere to send the money)");

const details = readSource("src/components/PaymentDetails.tsx");
const geoOrder = readSource("src/components/GeoOrder.tsx");
const geoSub = readSource("src/components/GeoSubOrder.tsx");
const subOrder = readSource("src/components/SubOrder.tsx");
const upsell = readSource("src/components/Upsell.tsx");
const subscribe = readSource("src/app/(zh)/geo/subscribe/page.tsx");
const orderRoute = readSource("src/app/api/order/route.ts");

check("PaymentDetails shows bank, account number and holder", () => {
  assert.ok(details.includes("6222031001026162672"), "account number missing");
  assert.ok(details.includes("廖献云"), "account holder missing");
  assert.ok(details.includes("supi24@163.com"), "alipay destination missing");
});

check("PaymentDetails has an English variant for the USD path", () => {
  assert.ok(details.includes('"en"'), "en variant missing");
});

for (const [name, src] of [
  ["GeoOrder", geoOrder],
  ["GeoSubOrder", geoSub],
  ["SubOrder", subOrder],
  ["Upsell", upsell],
  ["geo/subscribe page", subscribe],
]) {
  check(`${name} renders PaymentDetails`, () => {
    assert.ok(src.includes("PaymentDetails"), "no transfer details rendered");
  });
}

check("Upsell no longer claims an email with payment instructions", () => {
  assert.ok(
    !/Check your email for payment instructions/.test(upsell),
    "email claim still present"
  );
});

check("order route no longer promises a confirmation email", () => {
  assert.ok(
    !/reply to the confirmation email/.test(orderRoute),
    "confirmation-email promise still present"
  );
});

check("order result carries the orderId the transfer must reference", () => {
  assert.ok(/setOrderId\(j\.orderId\)/.test(upsell), "orderId not captured");
});

console.log(`\n${passed} payment-detail checks passed`);
