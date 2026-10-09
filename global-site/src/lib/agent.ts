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
  getOrder,
  updateOrder,
  saveReferral,
  type AgentEvent,
  type AgentMission,
} from "./store";
import { ownerAlertAddress, sendMail, sendOwnerAlert } from "./mail";
import type { OrderRecord } from "./store";

export type AgentEventKind = "lead" | "order" | "payment" | "intel";

const AUTO_SEND = process.env.AGENT_AUTO_SEND === "1";
// When set, a send failure is emailed to the operator instead of only sitting
// in the cockpit's "failed missions" list. Off by default: the cockpit is the
// primary surface, and mail sprawl is its own failure.
const ALERT_ON_FAILURE = process.env.AGENT_ALERT_ON_FAILURE === "1";
// Minimum sends before the outcome counters are trusted to pick a variant.
const VARIANT_MIN_SAMPLES = 3;

// --- Drafts ------------------------------------------------------------------

type Draft = { to: string; subject: string; body: string };
type DraftSet = Record<string, Draft>;

/**
 * Lead follow-up variants. v1 is the plain factual request; v2 is the same
 * honesty with a consultative opener. Both say exactly the same true things —
 * the difference is tone and length, which is the only axis an A/B test on
 * cold-adjacent mail is honest about. The planner picks by replied rate once
 * either variant has enough sends.
 */
function draftLeadSet(data: Record<string, unknown>): DraftSet {
  const lang = data.lang === "zh" ? "zh" : "en";
  const industry = String(data.industry || "your industry");
  const volume = Number(data.monthlyTickets || 0);
  const aht = Number(data.ahtMinutes || 0);
  const to = String(data.email || "");
  if (lang === "zh") {
    return {
      v1: {
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
      },
      v2: {
        to,
        subject: `贵司 ${industry} 客服测算 — 1-2 个问题即出结果`,
        body: [
          `你好，我是 Shiftless 负责你这条测算的同事。你提交了 ${industry}（月 ${volume} 条工单 / AHT ${aht} 分钟）。`,
          "",
          "回复下面 3 个数字，1 个工作日内给你完整版测算：",
          "1) 实际月工单量；2) 平均处理时长(分钟)；3) 当前客服人数。",
          "",
          "这版测算只基于你们的真实数字，不做夸张估算。",
          "",
          "— Shiftless",
        ].join("\n"),
      },
    };
  }
  return {
    v1: {
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
    },
    v2: {
      to,
      subject: `${industry} support automation — 3 numbers get you the math`,
      body: [
        `Hi, I'm the person on your Shiftless calculation (${industry} · ${volume} tickets/mo · ${aht} min AHT).`,
        "",
        "Reply with 3 numbers and you get the full calculation within one business day:",
        "1) actual monthly tickets; 2) average handle time (minutes); 3) current support headcount.",
        "",
        "The math is built only from your real numbers — no inflated assumptions.",
        "",
        "— Shiftless",
      ].join("\n"),
    },
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

/**
 * Pick the variant with the best observed replied rate among those with enough
 * sends; otherwise fall back to v1. Ties go to the more-sampled variant, which
 * keeps the choice stable instead of flapping on a single reply.
 */
async function pickVariant(kindKey: string, sets: DraftSet): Promise<{ id: string; draft: Draft }> {
  const k = await readAgentKnowledge();
  const entries = Object.entries(sets);
  if (entries.length <= 1) return { id: entries[0][0], draft: entries[0][1] };

  let bestId = "";
  let best: Draft | null = null;
  let bestRate = -1;
  let bestSamples = 0;
  for (const [id, draft] of entries) {
    const t = k.templates[`${kindKey}:${id}`];
    const sent = t?.sent ?? 0;
    const replied = t?.replied ?? 0;
    if (sent >= VARIANT_MIN_SAMPLES) {
      const rate = replied / sent;
      if (rate > bestRate || (rate === bestRate && sent > bestSamples)) {
        bestRate = rate;
        bestSamples = sent;
        bestId = id;
        best = draft;
      }
    }
    // v1 is the deterministic pre-data default.
    if (!best && id === "v1") {
      bestId = id;
      best = draft;
    }
  }
  return { id: bestId || entries[0][0], draft: best ?? entries[0][1] };
}

async function plan(ev: AgentEvent): Promise<AgentMission | null> {
  const d = ev.data;
  let draft: Draft | null = null;
  let kind = "";
  let variant = "";

  if (ev.kind === "lead" && d.email) {
    kind = "lead-followup";
    const v = await pickVariant(kind, draftLeadSet(d));
    draft = v.draft;
    variant = v.id;
  } else if (ev.kind === "payment" && d.ref && d.ref !== d.email) {
    kind = "referral-note";
    draft = draftReferral(d);
  } else if (ev.kind === "payment" && d.email) {
    kind = "delivery";
    draft = draftDelivery(d);
  } else if (ev.kind === "intel") {
    // Dead reference sources → an operator-facing task. Deterministic id on the
    // dead set so repeated identical cron runs update one mission instead of
    // piling up pending duplicates.
    const sources = Array.isArray(d.sources)
      ? (d.sources as { url: string; status: number; ok: boolean }[])
      : [];
    const dead = sources.filter((s) => !s.ok);
    const to = ownerAlertAddress();
    if (dead.length > 0 && to) {
      kind = "intel-dead-source";
      draft = {
        to,
        subject: `intel: ${dead.length} 个引用源失联`,
        body: [
          `intel 巡检发现 ${dead.length}/${sources.length} 个引用源不可达：`,
          "",
          ...dead.map((s) => `- ${s.url} (HTTP ${s.status || "unreachable"})`),
          "",
          "处置：更换为健康同主题来源，或在站点引用处标注最后一次可用时间。",
          "",
          "— 自动巡检（无需回复）",
        ].join("\n"),
      };
      const deadKey = dead
        .map((s) => `${s.url}:${s.status}`)
        .sort()
        .join("|");
      return {
        id: crypto.createHash("sha256").update(`intel-dead-source:${deadKey}`).digest("hex").slice(0, 16),
        kind,
        status: "pending",
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
        eventId: ev.id,
        context: { dead: dead.map((s) => s.url), total: sources.length },
        createdAt: new Date().toISOString(),
      };
    }
    return null;
  }

  if (!draft) return null;

  const id = crypto
    .createHash("sha256")
    .update(`${kind}:${variant}:${draft.to}:${ev.id}`)
    .digest("hex")
    .slice(0, 16);

  return {
    id,
    kind,
    variant: variant || undefined,
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
    const mission = await plan({ id: "", kind, ts: new Date().toISOString(), data });
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
      await updateMission(id, { status: "failed", failureReason: r.reason });
      await alertFailure(m, r.reason);
      return { ok: false, reason: r.reason };
    }
    await updateMission(id, { status: "sent", sentAt: new Date().toISOString() });
    await bumpKnowledge(kindKey(m.kind, m.variant), "sent");
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function retryMission(id: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const missions = await listMissions(2000);
    const m = missions.find((x) => x.id === id);
    if (!m) return { ok: false, reason: "not_found" };
    if (m.status !== "failed") return { ok: false, reason: `not_failed_but_${m.status}` };
    const r = await sendMail(m.to, m.subject, m.body);
    if (!r.sent) {
      await updateMission(id, { status: "failed", failureReason: r.reason });
      await alertFailure(m, r.reason);
      return { ok: false, reason: r.reason };
    }
    await updateMission(id, { status: "sent", sentAt: new Date().toISOString() });
    await bumpKnowledge(kindKey(m.kind, m.variant), "sent");
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
    await bumpKnowledge(kindKey(m.kind, m.variant), outcome === "replied" ? "replied" : outcome === "bounce" ? "failed" : "no-reply");
    return true;
  } catch {
    return false;
  }
}

function kindKey(kind: string, variant?: string): string {
  return variant ? `${kind}:${variant}` : kind;
}

async function alertFailure(m: AgentMission, reason: string): Promise<void> {
  if (!ALERT_ON_FAILURE) return;
  try {
    const r = await sendOwnerAlert(
      `[Shiftless] 任务发送失败 ${m.kind} → ${m.to}`,
      [
        "一条运营任务尝试发送邮件但失败了。",
        "",
        `kind: ${m.kind}`,
        `to: ${m.to}`,
        `subject: ${m.subject}`,
        `reason: ${reason}`,
        `mission: ${m.id}`,
        "",
        "在 /admin 操作台可重试或驳回。",
      ].join("\n")
    );
    if (!r.sent) console.log(`[AGENT-ALERT-FAIL] ${r.reason}`);
  } catch {
    // alerting is best-effort
  }
}

async function bumpKnowledge(kindSince: string, field: string): Promise<void> {
  try {
    const k = await readAgentKnowledge();
    const t = (k.templates[kindSince] ||= { drafted: 0, sent: 0, replied: 0, failed: 0 });
    if (field === "sent") t.sent += 1;
    else if (field === "replied") t.replied += 1;
    else if (field === "failed") t.failed += 1;
    k.updatedAt = new Date().toISOString();
    await writeAgentKnowledge(k);
  } catch {
    // learning is best-effort
  }
}

/**
 * Operator-facing confirmation that a manual/pending order was paid.
 *
 * The manual path intentionally never marks money as received by itself — only
 * a human confirming a transfer may. This flips the order to captured, writes
 * the referral ledger row when the buyer arrived via a shared ?ref= link, and
 * emits a payment event so delivery + referral-note missions are drafted.
 * Idempotent: an already-captured order is a no-op.
 */
export async function confirmManualPayment(
  orderId: string,
  operatorEmail: string
): Promise<{ ok: boolean; reason?: string; order?: OrderRecord }> {
  try {
    const order = await getOrder(orderId);
    if (!order) return { ok: false, reason: "not_found" };
    if (order.paymentState === "captured") {
      return { ok: true, reason: "already_captured", order };
    }
    if (order.paymentState !== "manual") {
      return { ok: false, reason: `state_${order.paymentState}` };
    }
    const ok = await updateOrder(orderId, { paymentState: "captured" });
    if (!ok) return { ok: false, reason: "update_failed" };

    if (order.ref && order.ref.includes("@")) {
      await saveReferral({
        referrer: order.ref,
        invitee: order.email,
        orderId: order.orderId,
        tier: order.tier,
        amount: order.amount ?? String(order.priceUsd),
        currency: order.currency ?? "USD",
        confirmedAt: new Date().toISOString(),
        source: "manual",
      });
    }

    await emit("payment", {
      orderId: order.orderId,
      email: order.email,
      ref: order.ref,
      permalink: order.permalink,
      amount: order.amount ?? String(order.priceUsd),
      currency: order.currency ?? "USD",
    });

    console.log(`[MANUAL-CONFIRM] ${orderId} captured by ${operatorEmail}`);
    return { ok: true, order: { ...order, paymentState: "captured" } };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export { listMissions };
export type { AgentMission };