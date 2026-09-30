import { NextRequest, NextResponse } from 'next/server';

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
const EMAIL_TO = process.env.LEAD_EMAIL_TO ?? 'sales@highkingflower.com';

export async function GET() {
  return NextResponse.json({ ok: false, error: 'method_not_allowed', hint: 'Use POST to submit a lead.' }, { status: 405 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LeadBody;
    if (!body.company || !body.name || !body.contact) {
      return NextResponse.json({ ok: false, error: 'company/name/contact required' }, { status: 400 });
    }

    const record = {
      ...body,
      ts: new Date().toISOString(),
      page: 'roi',
    };

    let sheetResult: { ok: boolean; note?: string } = { ok: false };

    // 1) Forward to Google Sheets / form service if configured
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

    // 2) Opportunistic email handoff (best-effort) when no sheet configured
    let emailResult: { ok: boolean } = { ok: false };
    if (!SHEET_ENDPOINT) {
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
      try {
        const res = await fetch(`https://formsubmit.co/ajax/${EMAIL_TO}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _subject: `【ROI 询盘】${body.company}`, _template: 'table', ...record, message: mailBody }),
          signal: AbortSignal.timeout(8000),
        });
        emailResult = { ok: res.ok };
      } catch { /* best-effort */ }
    }

    return NextResponse.json({
      ok: true,
      stored: true,
      sheet: sheetResult.ok,
      email: emailResult.ok,
      note: SHEET_ENDPOINT ? 'forwarded' : 'accepted (add LEAD_SHEET_WEBHOOK to persist to Sheets)',
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}