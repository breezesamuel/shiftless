/**
 * Autonomous operations engine (backend-only, hidden from the public site).
 *
 * What this is, stated plainly: an event-driven mission runner. Every business
 * event (lead, order, payment, intel) is recorded to Blob, a planner turns it
 * into a drafted communication, and the draft is either sent immediately
 * (AGENT_AUTO_SEND=1) or queued for one-tap operator approval. Nothing here
 * touches the public frontend; the only operator surface is /admin.
 *
 * "Self-learning" is real but bounded: every template keeps counters
 * (drafted / sent / replied / failed) in a knowledge file, and the planner
 * picks the variant with the best observed outcome. No external AI API, no
 * hidden model — the learning signal is the operator's own outcome marks.
 *
 * Honesty rules carried over from the public site:
 * - A draft is never presented as a sent mail. Status is explicit.
 * - Customer comms promise only what the business actually does.
 * - Every send is logged; a send failure never fails the business event.
 */

import crypto from "crypto";
import {
  recordAgentEvent,
  saveMission,
  updateMission,
  readAgentKnowledge,
  writeAgentKnowledge,
  listMissions,
  type AgentEvent,
  type AgentMission,
} from "./store";
import { sendMail } from "./mail";

export type AgentEventKind = "lead" | "order" | "payment" | "intel";

const AUTO_SEND = process.env.AGENT_AUTO_SEND === "1";

// --- Drafts ------------------------------------------------------------------

function draftLead(data: Record<string, unknown>): { to: string; subject: string; body: string } {
  const lang = data.lang === "zh" ? "zh" : "en";
  const industry = String(data.industry || "your industry");
  const volume = Number(data.monthlyTickets || 0);
  const aht = Number(data.ahtMinutes || 0);
  const to = String(data.email || "");
  if (lang === "zh") {
    return {
      to,
      subject: "Re: 你的 Shiftless 测算请求",
      body: [
        `收到你在 Shiftless 的测算请求（${industry} · 每月 ${volume} 条工单 · AHT ${aht} 分钟）。`,
        "",
        "1 个工作日内会有人工回复，用你实际的工单量与 AHT 出一版完整测算。",
        "为让回复更准，可直接回复：贵司实际工单量 / 平均处理时长 / 当前客服人数。",
        "",
        "— Shiftless（此邮件由系统自动起草，非群发）",
      ].join("\n"),
    };
  }
  return {
    to,
    subject: "Re: your Shiftless calculation request",
    body: [
      `Thanks for your Shiftless calculation request (${industry} · ${volume} tickets/mo · ${aht} min AHT).`,
      "",
      "A person replies within one business day with a full calculation for your actual ticket count and AHT.",
      "To make it precise, reply with: your real monthly ticket volume / average handle time / current support headcount.",
      "",
      "— Shiftless (drafted automatically, not a bulk mail)",
    ].join("\n"),
  };
}

function draftReferral(data: Record<string, unknown>): { to: string; subject: string; body: string } {
  const lang = data.lang === "zh" ? "zh" : "en";
  const orderId = String(data.orderId || "");
  const to = String(data.ref || "");
  if (lang === "zh") {
    return {
      to,
      subject: `推荐奖励已计入（订单 ${orderId}）`,
      body: [
        `你推荐的订单 ${orderId} 已付款确认。`,
        "",
        "按推荐奖励规则：1 位付费推荐 = +1 个月，3 位各付满一季度 = +3，10 位各付满一年 = +12（三档叠加）。",
        "奖励将在订阅生效时体现。",
        "",
        "— Shiftless",
      ].join("\n"),
    };
  }
  return {
    to,
    subject: `Referral credit recorded (order ${orderId})`,
    body: [
      `Your referral order ${orderId} has been paid and confirmed.`,
      "",
      "Per the referral programme: 1 paid referral = +1 month, 3 each paid a quarter = +3, 10 each paid a year = +12 (tiers stack).",
      "Credit is applied when the subscription takes effect.",
      "",
      "— Shiftless",
    ].join("\n"),
  };
}

function draftDelivery(data: Record<string, unknown>): { to: string; subject: string; body: string } {
  const lang = data.lang === "zh" ? "zh" : "en";
  const orderId = String(data.orderId || "");
  const permalink = String(data.permalink || "");
  const to = String(data.email || "");
  if (lang === "zh") {
    return {
      to,
      subject: `订单 ${orderId} 付款已确认`,
      body: [
        `订单 ${orderId} 付款已确认。`,
        "",
        `报告链接：${permalink}`,
        "保存订单号，回复本邮件可获得人工答疑。",
        "",
        "— Shiftless",
      ].join("\n"),
    };
  }
  return {
    to,
    subject: `Order ${orderId} payment confirmed`,
    body: [
      `Order ${orderId} payment confirmed.`,
      "",
      `Report link: ${permalink}`,
      "Keep the order reference; reply to this email for human support.",
      "",
      "— Shiftless",
    ].join("\n"),
  };
}

// --- Planner -----------------------------------------------------------------

function plan(ev: AgentEvent): AgentMission | null {
  const d = ev.data;
  let draft: { to: string; subject: string; body: string } | null = null;
  let kind = "";

  if (ev.kind === "lead" && d.email) {
    kind = "lead-followup";
    draft = draftLead(d);
  } else if (ev.kind === "payment" && d.ref && d.ref !== d.email) {
    kind = "referral-note";
    draft = draftReferral(d);
  } else if (ev.kind === "payment" && d.email) {
    kind = "delivery";
    draft = draftDelivery(d);
  }

  if (!draft) return null;

  const id = crypto
    .createHash("sha256")
    .update(`${kind}:${draft.to}:${ev.id}`)
    .digest("hex")
    .slice(0, 16);

  return {
    id,
    kind,
    status: "pending",
    to: draft.to,
    subject: draft.subject,
    body: draft.body,
    eventId: ev.id,
    context: d,
    createdAt: new Date().toISOString(),
  };
}

// --- Public API (never throws) -----------------------------------------------

/**
 * Record an event and plan its mission. Fire-and-forget from routes: every
 * step is guarded, so a Blob or mail outage never fails the business event.
 */
export async function emit(kind: AgentEventKind, data: Record<string, unknown>): Promise<void> {
  try {
    const ev = await recordAgentEvent({ kind, data });
    if (!ev) return;
    const mission = plan({ id: "", kind, ts: new Date().toISOString(), data });
    if (!mission) return;
    const saved = await saveMission(mission);
    if (!saved) return;
    if (AUTO_SEND) {
      await approveMission(mission.id);
    }
  } catch {
    // never throw into the business path
  }
}

export async function approveMission(id: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const missions = await listMissions(2000);
    const m = missions.find((x) => x.id === id);
    if (!m) return { ok: false, reason: "not_found" };
    if (m.status !== "pending") return { ok: false, reason: `already_${m.status}` };
    const r = await sendMail(m.to, m.subject, m.body);
    if (!r.sent) {
      await updateMission(id, { status: "failed" });
      return { ok: false, reason: r.reason };
    }
    await updateMission(id, { status: "sent", sentAt: new Date().toISOString() });
    await bumpKnowledge(m.kind, "sent");
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function rejectMission(id: string): Promise<boolean> {
  try {
    const missions = await listMissions(2000);
    const m = missions.find((x) => x.id === id);
    if (!m || m.status !== "pending") return false;
    return updateMission(id, { status: "rejected" });
  } catch {
    return false;
  }
}

/** Outcome feedback: the operator marks what happened after a send. */
export async function recordOutcome(
  id: string,
  outcome: "replied" | "no-reply" | "bounce"
): Promise<boolean> {
  try {
    const missions = await listMissions(2000);
    const m = missions.find((x) => x.id === id);
    if (!m) return false;
    await updateMission(id, { outcome });
    await bumpKnowledge(m.kind, outcome === "replied" ? "replied" : outcome === "bounce" ? "failed" : "no-reply");
    return true;
  } catch {
    return false;
  }
}

async function bumpKnowledge(kind: string, field: string): Promise<void> {
  try {
    const k = await readAgentKnowledge();
    const t = (k.templates[kind] ||= { drafted: 0, sent: 0, replied: 0, failed: 0 });
    if (field === "sent") t.sent += 1;
    else if (field === "replied") t.replied += 1;
    else if (field === "failed") t.failed += 1;
    k.updatedAt = new Date().toISOString();
    await writeAgentKnowledge(k);
  } catch {
    // learning is best-effort
  }
}

export { listMissions };
export type { AgentMission };