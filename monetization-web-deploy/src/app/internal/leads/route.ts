import { NextRequest, NextResponse } from 'next/server';
import { clientKey, rateLimit, isHoneypotTripped } from '@/lib/rateLimit';
import { ntfy } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LeadBody {
  company: string;
  name: string;
  contact: string;
  scene?: string;
  agent?: string;
  seats?: number;
  annual?: number;
  saving?: number;
  roi?: number;
  utm?: Record<string, string>;
  talk?: string;
}

const SHEET_ENDPOINT = process.env.LEAD_SHEET_WEBHOOK ?? '';
const WECOM_WEBHOOK = process.env.LEAD_WECOM_WEBHOOK ?? '';
const EMAIL_TO = process.env.LEAD_EMAIL_TO ?? '460123249@qq.com';

export async function GET() {
  return NextResponse.json({ ok: false, error: 'method_not_allowed', hint: 'Use POST to submit a lead.' }, { status: 405 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LeadBody;

    if (isHoneypotTripped(body)) {
      return NextResponse.json({ ok: true }, { status: 202 });
    }
    if (!rateLimit(`lead:${clientKey(request)}`)) {
      return NextResponse.json(
        { ok: false, error: 'rate_limited', hint: 'Too many submissions. Please try again in a minute.' },
        { status: 429 },
      );
    }
    if (!body.company || !body.name || !body.contact) {
      return NextResponse.json({ ok: false, error: 'company/name/contact required' }, { status: 400 });
    }

    const record = {
      ...body,
      ts: new Date().toISOString(),
      page: 'roi',
    };

    // Durable ledger — see orders/route.ts. Guarantees a recoverable record even when
    // every third-party push channel is unreachable.
    console.log('[LEAD] ' + JSON.stringify(record));

    let sheetResult: { ok: boolean; note?: string } = { ok: false };

    const mailBody = [
      `【ROI 询盘】${body.company}`,
      `联系人：${body.name}`,
      `联系方式：${body.contact}`,
      `场景：${body.scene || '—'}`,
      `方案：${body.agent || ''} × ${body.seats ?? ''} 席位`,
      `首年投入：¥${body.annual ?? ''}`,
      `年省：¥${body.saving ?? ''}`,
      `ROI：${body.roi ?? ''}`,
      body.utm && Object.keys(body.utm).length ? `渠道：${JSON.stringify(body.utm)}` : '',
      `话术：${body.talk ?? ''}`,
    ].filter(Boolean).join('\n');

    // 1) Instant push to WeCom group robot (where leads are actually read)
    let wecomResult: { ok: boolean; note?: string } = { ok: false };
    if (WECOM_WEBHOOK) {
      try {
        const res = await fetch(WECOM_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'markdown',
            markdown: {
              content: [
                `### 新 ROI 询盘 · ${body.company}`,
                `> 联系人：**${body.name}** ｜ ${body.contact}`,
                `> 场景：${body.scene || '—'}`,
                `> 方案：${body.agent || ''} × ${body.seats ?? ''} 席位`,
                `> 首年投入 ¥${body.annual ?? ''} · 年省 ¥${body.saving ?? ''} · ROI ${body.roi ?? ''}`,
                body.utm && Object.keys(body.utm).length ? `> 渠道：${JSON.stringify(body.utm)}` : '',
                `> \n> 请在 2 小时内联系。`,
              ].filter(Boolean).join('\n'),
            },
          }),
          signal: AbortSignal.timeout(8000),
        });
        wecomResult = { ok: res.ok };
      } catch (e) {
        wecomResult = { ok: false, note: String(e) };
      }
    }

    // 2) Forward to Google Sheets / form service if configured
    if (SHEET_ENDPOINT) {
      try {
        const res = await fetch(SHEET_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
          signal: AbortSignal.timeout(8000),
        });
        sheetResult = { ok: res.ok };
      } catch (e) {
        sheetResult = { ok: false, note: String(e) };
      }
    }

    // 3) Email handoff (best-effort)
    let emailResult: { ok: boolean } = { ok: false };
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${EMAIL_TO}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _subject: `【ROI 询盘】${body.company}`,
          _template: 'table',
          ...record,
          message: mailBody,
        }),
        signal: AbortSignal.timeout(8000),
      });
      emailResult = { ok: res.ok };
    } catch { /* best-effort */ }

    const ntfyOk = await ntfy(
      `📥 新询盘 · ${body.company}`,
      [
        `联系人: ${body.name} / ${body.contact}`,
        body.scene ? `场景: ${body.scene}` : '',
        body.agent ? `岗位: ${body.agent}` : '',
        body.seats ? `席位: ${body.seats}` : '',
        body.annual ? `年费: ¥${Number(body.annual).toLocaleString('zh-CN')}` : '',
        body.saving ? `年省: ¥${Number(body.saving).toLocaleString('zh-CN')}` : '',
        body.roi ? `ROI: ${body.roi}x` : '',
        body.utm && Object.keys(body.utm).length ? `渠道: ${JSON.stringify(body.utm)}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      'high',
      ['bell'],
    );

    const delivered = ntfyOk || wecomResult.ok || sheetResult.ok || emailResult.ok;

    return NextResponse.json({
      ok: true,
      delivered,
      ntfy: ntfyOk,
      wecom: wecomResult.ok,
      sheet: sheetResult.ok,
      email: emailResult.ok,
      note: delivered
        ? 'delivered'
        : 'accepted but no channel configured — set NTFY_TOPIC or LEAD_WECOM_WEBHOOK',
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}