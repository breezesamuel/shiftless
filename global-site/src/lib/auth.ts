import jwt from "jsonwebtoken";
import crypto from "crypto";
import { kv } from "@vercel/kv";

const MAGIC_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export type Session = {
  userId: string;
  email: string;
  exp: number;
  iat: number;
};

export function getMagicSecret(): string {
  const s = process.env.MAGIC_SECRET;
  if (s) return s;
  const j = process.env.JWT_SECRET;
  if (j) return j;
  return "dev-magic-secret";
}

export function getSessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  const j = process.env.JWT_SECRET;
  if (j) return j;
  return "dev-session-secret";
}

export function createMagicToken(email: string): string {
  const payload = { email: email.toLowerCase(), jti: crypto.randomUUID(), t: "magic" };
  return jwt.sign(payload, getMagicSecret(), { expiresIn: MAGIC_TTL_SECONDS });
}

export async function consumeMagicToken(token: string): Promise<{ email: string } | null> {
  try {
    const decoded = jwt.verify(token, getMagicSecret()) as any;
    if (decoded.t !== "magic") return null;
    const key = `magic:${decoded.jti}`;
    const used = await kv.get(key);
    if (used) return null;
    await kv.set(key, "1", { ex: MAGIC_TTL_SECONDS + 10 });
    return { email: String(decoded.email).toLowerCase() };
  } catch {
    return null;
  }
}

export function createSessionToken(userId: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: Session = {
    userId,
    email: email.toLowerCase(),
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  return jwt.sign(payload, getSessionSecret());
}

export function verifySession(token: string): Session | null {
  try {
    const d = jwt.verify(token, getSessionSecret()) as any;
    if (!d.userId || !d.email) return null;
    return {
      userId: d.userId,
      email: String(d.email).toLowerCase(),
      iat: d.iat,
      exp: d.exp,
    };
  } catch {
    return null;
  }
}
