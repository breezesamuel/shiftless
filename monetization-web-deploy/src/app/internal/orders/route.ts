import { NextRequest, NextResponse } from "next/server";
import { clientKey, rateLimit, isHoneypotTripped } from "@/lib/rateLimit";
import { CONTACT } from "@/lib/pricing";
import { ntfy, ntfyTopics } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OrderBody {
  company: string;
  name: string;
  contact: string;
  plan: string;
  planLabel: string;
  seats?: number;
  agent?: string;
  amount?: number;
  contractTerm?: string;
  notes?: string;
  utm?: Record<string, string>;
}

const SHEET_ENDPOINT = process.env.LEAD_SHEET_WEBHOOK ?? "";
const WECOM_WEBHOOK = process.env.LEAD_WECOM_WEBHOOK ?? "";
const EMAIL_TO = process.env.LEAD_EMAIL_TO ?? "460123249@qq.com";

function orderId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BD-${stamp}-${rand}`;
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed", hint: "Use POST to submit an order." }, { status: 405 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OrderBody;

    if (isHoneypotTripped(body)) {
      return NextResponse.json({ ok: true, orderId: "BD-RECEIVED" }, { status: 202 });
    }
    if (!rateLimit(`order:${clientKey(request)}`)) {
      return NextResponse.json(
        { ok: false, error: "rate_limited", hint: "Too many submissions. Please try again in a minute." },
        { status: 429 },
      );
    }
    if (!body.company || !body.name || !body.contact || !body.plan) {
      return NextResponse.json({ ok: false, error: "company/name/contact/plan required" }, { status: 400 });
    }

    const id = orderId();
    const record = { ...body, id, ts: new Date().toISOString(), page: "order" };

    // Durable ledger: every order is written to the platform log stream regardless of
    // whether a push channel is reachable. Notification services (ntfy) are third-party
    // and can block datacenter egress; the log line is what guarantees we can still
    // recover a lead. Retrieve with: npx vercel logs <deployment> --json
    console.log("[LEAD] " + JSON.stringify(record));

    const text = [
      `【订单 ${id}】${body.company}`,
      `联系人：${body.name}`,
      `联系方式：${body.contact}`,
      `方案：${body.planLabel || body.plan}`,
      `席位数：${body.seats ?? "—"}`,
      `金额：¥${(body.amount ?? 0).toLocaleString("zh-CN")}`,
      body.contractTerm ? `周期：${body.contractTerm}` : "",
      body.notes ? `备注：${body.notes}` : "",
      body.utm && Object.keys(body.utm).length ? `渠道：${JSON.stringify(body.utm)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    let wecomOk = false;
    if (WECOM_WEBHOOK) {
      try {
        const res = await fetch(WECOM_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            msgtype: "markdown",
            markdown: {
              content: [
                `### 💰 新订单 · ${body.company}`,
                `> 订单号：**${id}**`,
                `> 联系人：**${body.name}** ｜ ${body.contact}`,
                `> 方案：${body.planLabel || body.plan}${body.seats ? ` × ${body.seats} 席` : ""}`,
                `> 金额：**¥${(body.amount ?? 0).toLocaleString("zh-CN")}**`,
                body.notes ? `> 备注：${body.notes}` : "",
                `> \n> 请尽快联系确认并发送付款指引。`,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          }),
          signal: AbortSignal.timeout(8000),
        });
        wecomOk = res.ok;
      } catch {
        wecomOk = false;
      }
    }

    let sheetOk = false;
    if (SHEET_ENDPOINT) {
      try {
        const res = await fetch(SHEET_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record),
          signal: AbortSignal.timeout(8000),
        });
        sheetOk = res.ok;
      } catch {
        sheetOk = false;
      }
    }

    let emailOk = false;
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${EMAIL_TO}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _subject: `【订单 ${id}】${body.company}`,
          _template: "table",
          ...record,
          message: text,
        }),
        signal: AbortSignal.timeout(8000),
      });
      emailOk = res.ok;
    } catch {
      emailOk = false;
    }

    let ntfyOk = false;
    {
      ntfyOk = await ntfy(
        `💰 新订单 · ${body.company}`,
        [
          `订单号: ${id}`,
          `联系人: ${body.name} / ${body.contact}`,
          `方案: ${body.planLabel || body.plan}${body.seats ? ` × ${body.seats}席` : ""}`,
          `金额: ¥${(body.amount ?? 0).toLocaleString("zh-CN")}${body.contractTerm ? ` / ${body.contractTerm}` : ""}`,
          body.notes ? `备注: ${body.notes}` : "",
          body.utm && Object.keys(body.utm).length ? `渠道: ${JSON.stringify(body.utm)}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        "high",
        ["money", "package"],
      );
    }

    const delivered = ntfyOk || wecomOk || sheetOk || emailOk;

    // Nothing is persisted server-side, so if no channel accepted the order it would be
    // lost. Report the failure honestly and hand the customer a recoverable order number
    // plus a direct contact path, rather than a false "submitted" confirmation.
    return NextResponse.json(
      {
        ok: delivered,
        orderId: id,
        delivered,
        ntfy: ntfyOk,
        ntfyTopicsConfigured: ntfyTopics().length,
        wecom: wecomOk,
        sheet: sheetOk,
        email: emailOk,
        note: delivered
          ? "delivered"
          : "order_not_persisted: no delivery channel is configured yet",
        fallback: delivered
          ? undefined
          : {
              message:
                "订单编号已生成，但通知通道尚未接入，订单未入库保存。请截图本订单编号，并通过微信或电话联系我们完成下单。",
              orderId: id,
              wechat: CONTACT.wechat,
              phone: CONTACT.phone,
              email: CONTACT.email,
            },
      },
      { status: delivered ? 200 : 503 },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
