export async function sendMagicLink(email: string, url: string): Promise<void> {
  const key =
    process.env.RESEND_API_KEY ||
    process.env.SENDGRID_API_KEY ||
    process.env.SMTP_HOST;
  if (!key) {
    console.log(`[MAGIC-LINK-DEV] ${email} -> ${url}`);
    return;
  }
  console.log(`[MAGIC-LINK] would send to ${email}`);
}
