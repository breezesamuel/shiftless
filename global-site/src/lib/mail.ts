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
    auth: {
      user: process.env.SMTP_USER as string,
      pass: process.env.SMTP_AUTH_CODE as string,
    },
  });
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

  await buildTransport().sendMail({
    from,
    to: email,
    subject,
    text,
    html: `<p>点击下面的链接完成登录（10 分钟内有效，只能使用一次）：</p>
<p><a href="${url}">${url}</a></p>
<p>如果这不是你本人的操作，忽略这封邮件即可。</p>`,
  });

  return { sent: true, via: `smtp:${process.env.SMTP_HOST}` };
}
