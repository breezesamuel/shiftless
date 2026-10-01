/**
 * Alipay OpenAPI integration: RSA2 signing, page-pay order creation, and
 * asynchronous-notification verification.
 *
 * Why this module is strict about configuration
 * ---------------------------------------------
 * The previous version of the codebase decided "Alipay is live" from the mere
 * presence of ALIPAY_APP_ID + ALIPAY_PRIVATE_KEY. That is wrong twice over: it
 * reports a channel as available when no transaction code could run against it,
 * and it has no notion of the notify URL, seller id, or the Alipay *public* key
 * needed to verify that money actually arrived. A half-configured channel is
 * the worst possible state, because the failure surfaces at the checkout moment.
 *
 * So `alipayConfigured()` requires every variable a real transaction needs plus
 * an explicit ALIPAY_ENABLED=true opt-in. Anything less reports not-live, and
 * the UI falls back to the manual path.
 *
 * Hard platform constraint: Alipay settles CNY. A USD plan cannot be collected
 * through Alipay; `currencySupported()` returns false for USD so the caller
 * routes it to manual invoicing instead of pretending a dollar charge works.
 */

import crypto from "crypto";

export const SIGN_TYPE = "RSA2";
export const API_VERSION = "1.0";
export const DEFAULT_GATEWAY = "https://openapi.alipay.com/gateway.do";

/** Raised when a caller tries to transact without a complete configuration. */
export class AlipayNotConfiguredError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Alipay is not fully configured; missing: ${missing.join(", ")}`);
    this.name = "AlipayNotConfiguredError";
    this.missing = missing;
  }
}

export type AlipayConfig = {
  appId: string;
  privateKey: string;
  publicKey: string;
  gateway: string;
  sellerId: string;
  notifyUrl: string;
  returnUrl: string | null;
};

/** Every variable a live Alipay transaction needs. */
const REQUIRED = [
  "ALIPAY_ENABLED",
  "ALIPAY_APP_ID",
  "ALIPAY_PRIVATE_KEY",
  "ALIPAY_PUBLIC_KEY",
  "ALIPAY_GATEWAY",
  "ALIPAY_SELLER_ID",
  "ALIPAY_NOTIFY_URL",
] as const;

/**
 * Multi-line secrets pasted into an env var often arrive with literal "\n"
 * sequences, or with Windows CRLF, or wrapped in stray quotes. Normalise all of
 * it, otherwise a correct key fails to parse at the worst moment.
 */
function normaliseSecret(raw: string | undefined): string {
  if (!raw) return "";
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  if (s.includes("\\n")) s = s.replace(/\\n/g, "\n");
  return s.replace(/\r\n/g, "\n").trim();
}

function stripArmour(s: string): string {
  return s.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
}

/**
 * Load a private key from any of the shapes Alipay tooling emits:
 * full PKCS#1 or PKCS#8 PEM, or a bare base64 blob of either.
 */
export function loadPrivateKey(raw: string): crypto.KeyObject {
  const s = normaliseSecret(raw);
  if (!s) throw new Error("empty private key");

  const candidates: string[] = [];
  if (s.includes("BEGIN")) {
    candidates.push(s);
  } else {
    const body = stripArmour(s);
    candidates.push(
      `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`,
      `-----BEGIN RSA PRIVATE KEY-----\n${body}\n-----END RSA PRIVATE KEY-----`,
    );
  }

  const errors: string[] = [];
  for (const pem of candidates) {
    try {
      return crypto.createPrivateKey(pem);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  throw new Error(`could not parse private key: ${errors.join(" | ")}`);
}

/**
 * Load the Alipay public key. Alipay usually hands out a bare base64 X.509
 * SubjectPublicKeyInfo blob, so both armoured and unarmoured forms are tried.
 */
export function loadPublicKey(raw: string): crypto.KeyObject {
  const s = normaliseSecret(raw);
  if (!s) throw new Error("empty public key");

  const candidates: string[] = [];
  if (s.includes("BEGIN")) {
    candidates.push(s);
  } else {
    const body = stripArmour(s);
    candidates.push(
      `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`,
      `-----BEGIN RSA PUBLIC KEY-----\n${body}\n-----END RSA PUBLIC KEY-----`,
    );
  }

  const errors: string[] = [];
  for (const pem of candidates) {
    try {
      return crypto.createPublicKey(pem);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  throw new Error(`could not parse public key: ${errors.join(" | ")}`);
}

/**
 * Read the configuration, returning the list of things that are missing rather
 * than throwing. Callers use this both to gate checkout and to tell an operator
 * exactly what to set.
 */
export function alipayMissingEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const missing: string[] = [];
  if (String(env.ALIPAY_ENABLED || "").toLowerCase() !== "true") {
    missing.push("ALIPAY_ENABLED=true");
  }
  for (const key of REQUIRED) {
    if (key === "ALIPAY_ENABLED") continue;
    if (!normaliseSecret(env[key])) missing.push(key);
  }

  // A notify URL that is not HTTPS cannot receive a server-to-server callback
  // from Alipay's servers in a way we are willing to trust.
  const notify = normaliseSecret(env.ALIPAY_NOTIFY_URL);
  if (notify && !/^https:\/\//i.test(notify)) {
    missing.push("ALIPAY_NOTIFY_URL (must be https)");
  }

  return missing;
}

export function alipayConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return alipayMissingEnv(env).length === 0;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AlipayConfig {
  const missing = alipayMissingEnv(env);
  if (missing.length) throw new AlipayNotConfiguredError(missing);

  return {
    appId: normaliseSecret(env.ALIPAY_APP_ID),
    privateKey: normaliseSecret(env.ALIPAY_PRIVATE_KEY),
    publicKey: normaliseSecret(env.ALIPAY_PUBLIC_KEY),
    gateway: normaliseSecret(env.ALIPAY_GATEWAY) || DEFAULT_GATEWAY,
    sellerId: normaliseSecret(env.ALIPAY_SELLER_ID),
    notifyUrl: normaliseSecret(env.ALIPAY_NOTIFY_URL),
    returnUrl: normaliseSecret(env.ALIPAY_RETURN_URL) || null,
  };
}

/**
 * Alipay's canonical signing string: every parameter except `sign` and
 * blank values, sorted by key in ASCII order, joined as `k=v` with raw
 * (un-encoded) values.
 *
 * The raw-vs-encoded distinction is the classic source of "signature invalid"
 * bugs: sign the raw values, then URL-encode only when building the query
 * string.
 */
export function signingString(params: Record<string, string | undefined>): string {
  return Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type")
    .filter((k) => {
      const v = params[k];
      return v !== undefined && v !== null && String(v).length > 0;
    })
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

export function signParams(
  params: Record<string, string | undefined>,
  privateKeyPem: string
): string {
  const key = loadPrivateKey(privateKeyPem);
  const data = signingString(params);
  return crypto.createSign("RSA-SHA256").update(data, "utf8").sign(key, "base64");
}

/**
 * Verify a signature. Used for both our own request signing (self-check in
 * tests) and for the notify callback, where `publicKeyPem` is Alipay's key.
 */
export function verifySignature(
  params: Record<string, string | undefined>,
  signature: string,
  publicKeyPem: string
): boolean {
  try {
    const key = loadPublicKey(publicKeyPem);
    const data = signingString(params);
    return crypto
      .createVerify("RSA-SHA256")
      .update(data, "utf8")
      .verify(key, signature, "base64");
  } catch {
    return false;
  }
}

function timestamp(d: Date = new Date()): string {  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

/** Alipay expects the amount as a 2-decimal string, e.g. "60.00". */
export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`invalid amount: ${amount}`);
  }
  return amount.toFixed(2);
}

/**
 * URL-encode params into a signed query string.
 *
 * Encoding happens only here, never before signing — the signature covers the
 * raw values, so encoding first would produce a signature Alipay cannot
 * reproduce.
 */
function toSignedRequest(
  gateway: string,
  params: Record<string, string>,
  signature: string
): SignedRequest {
  const signed: Record<string, string> = { ...params, sign: signature };
  const qs = Object.keys(signed)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(signed[k])}`)
    .join("&");
  return { url: `${gateway}?${qs}`, method: params.method, params: signed, signature };
}

export type PagePayInput = {
  outTradeNo: string;
  amount: number;
  subject: string;
  /** Free-form echo that comes back on both return_url and notify_url. */
  passbackParams?: string;
  timeoutExpress?: string;
};

export type SignedRequest = {
  url: string;
  method: string;
  params: Record<string, string>;
  signature: string;
};

/**
 * Build a signed `alipay.trade.page.pay` request.
 *
 * Returned as a GET-able URL so the browser can be redirected straight to
 * Alipay with no intermediate page. `sign` is recomputed from the exact params
 * we send, and a self-verification pass runs before returning: if the signature
 * does not validate against the app's own public key, we throw rather than send
 * a request Alipay will reject.
 */
export function buildPagePay(
  input: PagePayInput,
  env: NodeJS.ProcessEnv = process.env
): SignedRequest {
  const cfg = loadConfig(env);

  if (!input.outTradeNo || !/^[A-Za-z0-9_-]{1,64}$/.test(input.outTradeNo)) {
    throw new Error(`invalid out_trade_no: ${input.outTradeNo}`);
  }
  if (!input.subject || input.subject.length > 256) {
    throw new Error("invalid subject");
  }

  const bizContent: Record<string, string> = {
    out_trade_no: input.outTradeNo,
    product_code: "FAST_INSTANT_TRADE_PAY",
    total_amount: formatAmount(input.amount),
    subject: input.subject,
  };
  if (input.passbackParams) bizContent.passback_params = input.passbackParams;
  if (input.timeoutExpress) bizContent.timeout_express = input.timeoutExpress;

  const params: Record<string, string> = {
    app_id: cfg.appId,
    method: "alipay.trade.page.pay",
    format: "JSON",
    charset: "utf-8",
    sign_type: SIGN_TYPE,
    version: API_VERSION,
    timestamp: timestamp(),
    notify_url: cfg.notifyUrl,
    biz_content: JSON.stringify(bizContent),
  };
  if (cfg.returnUrl) params.return_url = cfg.returnUrl;

  const signature = signParams(params, cfg.privateKey);

  // Self-check: never emit a request we cannot prove is correctly signed.
  if (!verifySignature(params, signature, cfg.publicKey)) {
    throw new Error(
      "generated signature failed self-verification; ALIPAY_PUBLIC_KEY does not match ALIPAY_PRIVATE_KEY"
    );
  }

  return toSignedRequest(cfg.gateway, params, signature);
}

/** Trade statuses that mean the customer actually paid. */
export const PAID_TRADE_STATUS = ["TRADE_SUCCESS", "TRADE_FINISHED"] as const;

export type NotifyVerdict =
  | { ok: true; event: "paid" | "closed" | "pending"; outTradeNo: string; amount: number; tradeNo: string }
  | { ok: false; reason: string };

/**
 * Validate an `alipay.trade.notify` callback.
 *
 * Order of checks matters. Signature first (nothing else can be trusted before
 * that), then app_id, then seller_id, then amount. Checking the amount last is
 * not optional: a valid signature only proves Alipay sent the message, not that
 * it matches the order we created — and a mismatch means the caller paid the
 * wrong price for the plan they get.
 */
export function verifyNotify(
  params: Record<string, string>,
  expectedAmountCny: number | null,
  env: NodeJS.ProcessEnv = process.env
): NotifyVerdict {
  let cfg: AlipayConfig;
  try {
    cfg = loadConfig(env);
  } catch (e) {
    return { ok: false, reason: "not_configured" };
  }

  const sign = params.sign;
  if (!sign) return { ok: false, reason: "missing_sign" };

  if (!verifySignature(params, sign, cfg.publicKey)) {
    return { ok: false, reason: "bad_signature" };
  }

  if (params.app_id !== cfg.appId) {
    return { ok: false, reason: "app_id_mismatch" };
  }

  if (params.seller_id && cfg.sellerId && params.seller_id !== cfg.sellerId) {
    return { ok: false, reason: "seller_id_mismatch" };
  }

  const outTradeNo = params.out_trade_no || "";
  if (!outTradeNo) return { ok: false, reason: "missing_out_trade_no" };

  let amount = 0;
  if (params.total_amount) {
    const parsed = Number(params.total_amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { ok: false, reason: "bad_total_amount" };
    }
    amount = parsed;
  }

  if (
    expectedAmountCny !== null &&
    Math.abs(amount - expectedAmountCny) > 0.001
  ) {
    return { ok: false, reason: "amount_mismatch" };
  }

  const status = params.trade_status || "";
  const event = (PAID_TRADE_STATUS as readonly string[]).includes(status)
    ? "paid"
    : status === "TRADE_CLOSED"
      ? "closed"
      : "pending";

  return {
    ok: true,
    event,
    outTradeNo,
    amount,
    tradeNo: params.trade_no || "",
  };
}

/** Alipay expects the literal body "success" to stop retrying. */
export const ALIPAY_NOTIFY_BODY = {
  success: "success",
  failure: "failure",
} as const;

export type RefundInput = {
  outTradeNo: string;
  refundAmount: number;
  outRequestNo?: string;
  reason?: string;
};

/** Build a signed `alipay.trade.refund` request. */
export function buildRefund(
  input: RefundInput,
  env: NodeJS.ProcessEnv = process.env
): SignedRequest {
  const cfg = loadConfig(env);
  if (!input.outTradeNo) throw new Error("refund needs out_trade_no");
  if (!Number.isFinite(input.refundAmount) || input.refundAmount <= 0) {
    throw new Error(`invalid refund amount: ${input.refundAmount}`);
  }

  const bizContent: Record<string, string> = {
    out_trade_no: input.outTradeNo,
    refund_amount: formatAmount(input.refundAmount),
  };
  if (input.outRequestNo) bizContent.out_request_no = input.outRequestNo;
  if (input.reason) bizContent.refund_reason = input.reason;

  const params: Record<string, string> = {
    app_id: cfg.appId,
    method: "alipay.trade.refund",
    format: "JSON",
    charset: "utf-8",
    sign_type: SIGN_TYPE,
    version: API_VERSION,
    timestamp: timestamp(),
    biz_content: JSON.stringify(bizContent),
  };

  const signature = signParams(params, cfg.privateKey);
  if (!verifySignature(params, signature, cfg.publicKey)) {
    throw new Error("refund signature failed self-verification");
  }

  return toSignedRequest(cfg.gateway, params, signature);
}

/**
 * POST a signed request to the gateway and parse the JSON reply.
 *
 * Kept separate from the signing so it can be swapped for the official SDK
 * later without touching verification logic.
 */
export async function callAlipay(
  req: SignedRequest,
  fetchImpl: typeof fetch = fetch
): Promise<Record<string, unknown>> {
  const res = await fetchImpl(req.url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: Object.keys(req.params)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(req.params[k])}`)
      .join("&"),
  });

  if (!res.ok) {
    throw new Error(`alipay gateway HTTP ${res.status}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`alipay gateway returned non-JSON: ${text.slice(0, 200)}`);
  }
}
