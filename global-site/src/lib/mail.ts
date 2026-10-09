import nodemailer from "nodemailer";

export type SendResult =
  | { sent: true; via: string }
  | { sent: false; reason: string };

/**
 * QQ Mail (and most SMTP providers) need:
 *   SMTP_HOST       e.g. smtp.qq.com
 *   SMTP_PORT       465 (implicit TLS) or 587 (STARTTLS)
 *   SMTP_USER       the full mailbox address
 *   SMTP_AUTH_CODE  the provider-issued authorization code, NOT the password
 *   EMAIL_FROM      optional display-from, defaults to SMTP_USER
 *
 * The authorization code is a secret. It belongs in Vercel env vars or the local
 * .env file, never in source and never in a commit.
 */
export function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_AUTH_CODE
  );
}

function buildTransport() {
  const port = Number(process.env.SMTP_PORT || 465);
  const host = process.env.SMTP_HOST as string;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    // Bound every stage. A hung SMTP socket inside a serverless function is
    // worse than a failed send: it burns the whole invocation budget and can
    // turn a lead that was already stored into a visitor-facing timeout.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: {
      user: process.env.SMTP_USER as string,
      pass: process.env.SMTP_AUTH_CODE as string,
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Pull a bare address out of a value that may be decorated with a display name
 * ("Shiftless <hi@example.com>"). EMAIL_FROM is routinely set that way, and
 * using the decorated form as an SMTP recipient produces an RCPT TO the server
 * rejects, so the recipient is always normalised down to the address itself.
 */
export function bareAddress(raw: string): string {
  const angled = raw.match(/<([^>]+)>/);
  if (angled) return angled[1].trim();
  const bare = raw.match(/[^\s<>]+@[^\s<>]+/);
  return (bare ? bare[0] : raw).trim();
}

/**
 * Where operator alerts go.
 *
 * An explicit OWNER_ALERT_EMAIL wins, but the default is the mailbox the site
 * already sends from — the operator obviously reads that one — so alerting
 * starts working with no new configuration. That matters here specifically:
 * the whole failure being fixed is that leads and orders landed in a store
 * nobody was watching.
 */
export function ownerAlertAddress(): string | null {
  const raw =
    process.env.OWNER_ALERT_EMAIL ||
    process.env.LEAD_NOTIFY_EMAIL ||
    process.env.SMTP_USER ||
    process.env.EMAIL_FROM ||
    "";
  const addr = bareAddress(raw);
  return addr.includes("@") ? addr : null;
}

/**
 * True when a new lead/order will actually reach a human. This is the whole
 * point of the alert path, so it is reported as a first-class health check
 * rather than left to be inferred from the SMTP flags.
 */
export function ownerAlertConfigured(): boolean {
  return smtpConfigured() && ownerAlertAddress() !== null;
}

/**
 * Best-effort operator notification.
 *
 * Returns a result instead of throwing. Every caller has already persisted the
 * lead or order; a mail outage must never turn a successful submission into a
 * failed one, so the failure is recorded (in the caller's log line) and the
 * response goes out unchanged.
 */
export async function sendOwnerAlert(
  subject: string,
  body: string
): Promise<SendResult> {
  if (!smtpConfigured()) return { sent: false, reason: "smtp_not_configured" };
  const to = ownerAlertAddress();
  if (!to) return { sent: false, reason: "owner_alert_address_unset" };

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  try {
    await buildTransport().sendMail({
      from,
      to,
      subject,
      text: body,
      html:
        `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;` +
        `font-size:13px;white-space:pre-wrap;line-height:1.5">${escapeHtml(body)}</pre>`,
    });
    return { sent: true, via: `smtp:${process.env.SMTP_HOST}` };
  } catch {
    return { sent: false, reason: "send_failed" };
  }
}

/**
 * General outbound mail (customer-facing comms from the agent engine).
 *
 * Same contract as sendOwnerAlert: never throws, bounded timeouts, SMTP
 * failure is a result not an exception. The caller has already persisted the
 * event that triggered the mail, so a send failure must never fail the
 * request that produced it.
 */
export async function sendMail(
  to: string,
  subject: string,
  body: string
): Promise<SendResult> {
  if (!smtpConfigured()) return { sent: false, reason: "smtp_not_configured" };
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  try {
    await buildTransport().sendMail({
      from,
      to,
      subject,
      text: body,
      html:
        `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;` +
        `font-size:13px;white-space:pre-wrap;line-height:1.5">${escapeHtml(body)}</pre>`,
    });
    return { sent: true, via: `smtp:${process.env.SMTP_HOST}` };
  } catch {
    return { sent: false, reason: "send_failed" };
  }
}

export async function sendMagicLink(email: string, url: string): Promise<SendResult> {
  if (!smtpConfigured()) {
    return {
      sent: false,
      reason: "smtp_not_configured",
    };
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const subject = "你的 Shiftless 登录链接";
  const text = [
    "点击下面的链接完成登录（10 分钟内有效，只能使用一次）：",
    url,
    "",
    "如果这不是你本人的操作，忽略这封邮件即可。",
  ].join("\n");

  try {
    await buildTransport().sendMail({
      from,
      to: email,
      subject,
      text,
      html: `<p>点击下面的链接完成登录（10 分钟内有效，只能使用一次）：</p>
<p><a href="${url}">${url}</a></p>
<p>如果这不是你本人的操作，忽略这封邮件即可。</p>`,
    });
  } catch {
    // The route turns a non-sent result into an honest 503. Throwing instead
    // would surface as a blank 500 at the exact moment a returning user is
    // trying to log in.
    return { sent: false, reason: "send_failed" };
  }

  return { sent: true, via: `smtp:${process.env.SMTP_HOST}` };
}
