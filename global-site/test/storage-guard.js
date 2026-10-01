/**
 * Storage-guard and auth-logic regression tests.
 *
 * These run against the real modules with KV deliberately absent, which is the
 * state production is in today. The point is that an unprovisioned database
 * produces an explicit, honest answer instead of a 500 or a fabricated "10
 * uses left".
 */

process.env.KV_REST_API_URL = "";
process.env.KV_REST_API_TOKEN = "";
delete process.env.MAGIC_SECRET;
delete process.env.SESSION_SECRET;
delete process.env.JWT_SECRET;

const assert = require("assert");
let passed = 0;
function check(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === "function") {
      throw new Error("use checkAsync for async assertions");
    }
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
  return require("fs").readFileSync(require("path").join(__dirname, "..", rel), "utf8");
}

console.log("store.ts");
const store = require("../src/lib/store.ts");

check("FREE_USES_LIMIT is 10", () => {
  assert.strictEqual(store.FREE_USES_LIMIT, 10);
});

check("isKvConfigured() is false with no env", () => {
  assert.strictEqual(store.isKvConfigured(), false);
});

check("storageState() reports unconfigured", () => {
  assert.strictEqual(store.storageState(), "unconfigured");
});

check("StorageNotConfiguredError is exported and named", () => {
  assert.strictEqual(typeof store.StorageNotConfiguredError, "function");
  const e = new store.StorageNotConfiguredError();
  assert.strictEqual(e.name, "StorageNotConfiguredError");
  assert.ok(/KV_REST_API_URL/.test(e.message));
});

(async () => {
  await checkAsync("getQuota throws StorageNotConfiguredError, not a generic Error", async () => {
    await assert.rejects(() => store.getQuota("any-user"), store.StorageNotConfiguredError);
  });

  await checkAsync("bumpQuotaIfFree throws StorageNotConfiguredError", async () => {
    await assert.rejects(
      () => store.bumpQuotaIfFree("any-user"),
      store.StorageNotConfiguredError
    );
  });

  await checkAsync("getOrCreateUser throws StorageNotConfiguredError", async () => {
    await assert.rejects(
      () => store.getOrCreateUser("a@b.com"),
      store.StorageNotConfiguredError
    );
  });

  console.log("auth.ts");
  const auth = require("../src/lib/auth.ts");

  check("secretsAreReal() is false when no secret is set", () => {
    assert.strictEqual(auth.secretsAreReal(), false);
  });

  check("magic token round-trips", () => {
    const t = auth.createMagicToken("User@Example.COM");
    assert.ok(t.split(".").length === 3);
  });

  check("session token round-trips and lowercases email", () => {
    const t = auth.createSessionToken("u1", "User@Example.COM");
    const s = auth.verifySession(t);
    assert.ok(s);
    assert.strictEqual(s.email, "user@example.com");
    assert.strictEqual(s.userId, "u1");
  });

  check("garbage session token is rejected", () => {
    assert.strictEqual(auth.verifySession("not-a-token"), null);
  });

  check("empty session token is rejected", () => {
    assert.strictEqual(auth.verifySession(""), null);
  });

  check("magic token cannot be used as a session token", () => {
    const t = auth.createMagicToken("a@b.com");
    assert.strictEqual(auth.verifySession(t), null);
  });

  console.log("routes must degrade honestly");
  const magic = readSource("src/app/api/auth/magic/route.ts");
  const session = readSource("src/app/api/auth/session/route.ts");
  const quota = readSource("src/app/api/quota/route.ts");
  const uses = readSource("src/app/api/audit-uses/route.ts");
  const mail = readSource("src/lib/mail.ts");

  check("magic route gates on isKvConfigured", () => {
    assert.ok(/isKvConfigured\(\)/.test(magic));
    assert.ok(/503/.test(magic));
  });

  check("magic route never claims a mail was sent when send failed", () => {
    assert.ok(/if \(!result\.sent\)/.test(magic));
    assert.ok(!/resend/i.test(mail));
  });

  check("mail does not fake a successful send", () => {
    assert.ok(/sent: false/.test(mail));
    assert.ok(!/would send/.test(mail));
    assert.ok(!/MAGIC-LINK-DEV/.test(mail));
  });

  check("session route maps storage errors to 503", () => {
    assert.ok(/StorageNotConfiguredError/.test(session));
    assert.ok(/503/.test(session));
  });

  check("quota route reports storage state and nulls numbers when unconfigured", () => {
    assert.ok(/storage: "unconfigured"/.test(quota));
    assert.ok(/used: null/.test(quota));
    assert.ok(/remaining: null/.test(quota));
  });

  check("quota route never leaks the request origin", () => {
    assert.ok(!/origin: reset/.test(quota));
    assert.ok(!/new URL\(req\.url\)\.origin/.test(quota));
  });

  check("audit-uses gates on isKvConfigured and 503s", () => {
    assert.ok(/isKvConfigured\(\)/.test(uses));
    assert.ok(/503/.test(uses));
  });

  check("session cookie is httpOnly and sameSite", () => {
    assert.ok(/httpOnly: true/.test(session));
    assert.ok(/sameSite: "lax"/.test(session));
  });

  check("free-quota copy uses the shared FREE_USES limit, not a local 10", () => {
    const card = readSource("src/components/FreeQuotaCard.tsx");
    assert.ok(/freeUsesTotal/.test(card));
    assert.ok(!/FREE_USES_LIMIT\s*=\s*\d+/.test(card));
  });

  console.log(`\n${passed} checks passed`);
})();
