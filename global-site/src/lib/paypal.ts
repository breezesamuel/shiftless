/**
 * PayPal checkout for USD orders.
 *
 * Why PayPal and not the Alipay rail: Alipay settles CNY only, and every USD
 * order on this site was therefore falling back to "transfer manually and we
 * will email you" — with no email ever sent. PayPal covers the card/USD path
 * end to end: create an order, redirect the buyer to approve, capture on the
 * return hop.
 *
 * Failure policy (same rule the Alipay path follows): if any step fails, this
 * module returns null and the order route falls back to manual fulfilment.
 * A broken payment credential must degrade to the honest offline path, never
 * to a redirect that 500s after the buyer has decided to pay.
 *
 * Secrets live in env only: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and
 * PAYPAL_MODE ("sandbox" | anything-else = live).
 */

const BASE = () =>
  process.env.PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

export function paypalConfigured(): boolean {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET
  );
}

// Token is short-lived (~32 min) and costs a network round trip; caching it
// for the instance lifetime is safe because serverless instances are recycled
// long before the expiry, and a stale token simply fails the next call, which
// then falls back to manual fulfilment.
let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${BASE()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`paypal token ${res.status}`);

  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: j.access_token,
    exp: Date.now() + j.expires_in * 1000,
  };
  return cached.token;
}

export type CreatedOrder = { id: string; approveUrl: string };

/**
 * Create a PayPal order and return the buyer-facing approve URL.
 *
 * The server still owns the amount: the caller passes the price it looked up
 * from its own table, and this module never reads an amount from a client.
 * `custom_id` and `invoice_id` carry our order id so a capture can be matched
 * to the order log without any server-side store.
 */
export async function createOrder(opts: {
  amount: string;
  orderId: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<CreatedOrder | null> {
  try {
    const res = await fetch(`${BASE()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await accessToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: { currency_code: "USD", value: opts.amount },
            description: opts.description,
            custom_id: opts.orderId,
            invoice_id: opts.orderId,
          },
        ],
        application_context: {
          return_url: opts.returnUrl,
          cancel_url: opts.cancelUrl,
          user_action: "PAY_NOW",
          brand_name: "Shiftless",
        },
      }),
    });
    if (!res.ok) return null;

    const j = (await res.json()) as {
      id?: string;
      links?: { rel: string; href: string }[];
    };
    const approve = j.links?.find((l) => l.rel === "approve");
    if (!j.id || !approve) return null;
    return { id: j.id, approveUrl: approve.href };
  } catch {
    return null;
  }
}

export type CaptureResult =
  | {
      ok: true;
      paypalOrderId: string;
      amount: string;
      currency: string;
      payerEmail: string | null;
      status: string;
    }
  | { ok: false; status: string };

/** Capture a PayPal order the buyer already approved. */
export async function captureOrder(
  paypalOrderId: string
): Promise<CaptureResult | null> {
  if (!/^[0-9A-Za-]{8,}$/.test(paypalOrderId)) return null;
  try {
    const res = await fetch(
      `${BASE()}/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${await accessToken()}`,
          "content-type": "application/json",
        },
        body: "{}",
      }
    );
    const j = (await res.json()) as {
      id?: string;
      status?: string;
      payer?: { email_address?: string };
      purchase_units?: {
        payments?: {
          captures?: {
            amount?: { value?: string; currency_code?: string };
          }[];
        };
      }[];
    };
    const capture = j.purchase_units?.[0]?.payments?.captures?.[0];
    if (!capture || !j.id) {
      return { ok: false, status: j.status || String(res.status) };
    }
    return {
      ok: true,
      paypalOrderId: j.id,
      amount: capture.amount?.value || "",
      currency: capture.amount?.currency_code || "",
      payerEmail: j.payer?.email_address || null,
      status: j.status || "",
    };
  } catch {
    return null;
  }
}
