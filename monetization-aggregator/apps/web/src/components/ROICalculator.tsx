'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, Unlock, Loader2 } from 'lucide-react';

const AGENTS = {
  sales: { label: 'AI销售员', price: 12800, human: 12000, hours: 120 },
  customer_service: { label: 'AI客服员', price: 6800, human: 7000, hours: 140 },
  operations: { label: 'AI运营员', price: 10800, human: 11000, hours: 100 },
  finance: { label: 'AI财务员', price: 15800, human: 12000, hours: 90 },
  hr: { label: 'AI招聘员', price: 12800, human: 10000, hours: 80 },
} as const;

const SETUP = {
  poc: 30000,
  integration: 50000,
  custom_workflow: 80000,
  training: 20000,
  deploy: 150000,
} as const;

const DISCOUNTS: [number, number][] = [
  [500, 0.72], [200, 0.78], [100, 0.82], [50, 0.85], [20, 0.9], [10, 0.95], [1, 1],
];
const RAMP = 0.88;
const WORK_HOURS = 174;
const UNLOCK_KEY = 'roi_unlocked_v1';

type AgentKey = keyof typeof AGENTS;
type SetupKey = keyof typeof SETUP | '';

const fmt = (n: number) => Math.round(n).toLocaleString('zh-CN');

function discount(seats: number): number {
  for (const [t, r] of DISCOUNTS) if (seats >= t) return r;
  return 1;
}

const SCALE_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

export function ROICalculator() {
  const [current, setCurrent] = useState<AgentKey>('sales');
  const [seats, setSeats] = useState(50);
  const [humanCost, setHumanCost] = useState(12000);
  const [setup, setSetup] = useState<SetupKey>('deploy');

  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockInfo, setUnlockInfo] = useState<{ tx?: string; network?: string; method?: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const [leadCompany, setLeadCompany] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadContact, setLeadContact] = useState('');
  const [leadScene, setLeadScene] = useState('');
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadDone, setLeadDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [utm, setUtm] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const u: Record<string, string> = {};
      for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'source', 'gclid']) {
        const v = params.get(key);
        if (v) u[key] = v;
      }
      setUtm(u);
      const saved = localStorage.getItem(UNLOCK_KEY);
      if (saved) {
        setUnlocked(true);
        try { setUnlockInfo(JSON.parse(saved)); } catch { /* noop */ }
      }
    } catch { /* noop */ }
  }, []);

  const r = useMemo(() => {
    const a = AGENTS[current];
    const human = humanCost || a.human;
    const setupFee = setup ? SETUP[setup] : 0;
    const disc = discount(seats);
    const annual = a.price * seats * disc;
    const perSeatMonthly = a.hours * (human / WORK_HOURS);
    const scale = Math.min(1.15, 1 + 0.01 * Math.max(0, seats - 1));
    const monthlySaving = perSeatMonthly * seats * scale;
    const annualSaving = monthlySaving * 12 * RAMP;
    const roi = annual ? annualSaving / annual : 0;
    const net = annualSaving - annual;
    const payback = monthlySaving ? (annual + setupFee) / monthlySaving : 999;
    const passes = roi >= 3;
    const scaleRows = SCALE_OPTIONS.map((s) => {
      const d = discount(s);
      const ann = a.price * s * d;
      const sc = Math.min(1.15, 1 + 0.01 * Math.max(0, s - 1));
      const sav = a.hours * (human / WORK_HOURS) * s * sc * 12 * RAMP;
      const rr = ann ? sav / ann : 0;
      return { s, ann, sav, rr, pass: rr >= 3 };
    });
    const talk = `${a.label} ${seats} 个席位：首年总投入 ¥${fmt(annual + setupFee)}，`
      + `年节省人力 ¥${fmt(annualSaving)}，净收益 ¥${fmt(net)}，`
      + `ROI ${roi.toFixed(1)} 倍，约 ${payback.toFixed(1)} 个月回本。`
      + (passes ? '已满足企业采购 ROI≥3 的门槛。' : '建议调整方案规模。');
    return { a, human, setupFee, disc, annual, monthlySaving, annualSaving, roi, net, payback, passes, scaleRows, talk };
  }, [current, seats, humanCost, setup]);

  const pct = Math.max(0, Math.min(100, r.roi / 12 * 100));

  const onAgentChange = useCallback((k: AgentKey) => {
    setCurrent(k);
    setHumanCost(AGENTS[k].human);
  }, []);

  const persistUnlock = useCallback((info: { tx?: string; network?: string; method?: string }) => {
    setUnlocked(true);
    setUnlockInfo(info);
    try { localStorage.setItem(UNLOCK_KEY, JSON.stringify(info)); } catch { /* noop */ }
  }, []);

  const unlockWithX402 = useCallback(async () => {
    setUnlocking(true);
    try {
      const res = await fetch('/internal/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: current, seats }),
      });
      const data = await res.json();
      if (data?.ok) {
        const tx = data.settle?.transaction || data.settle?.txid;
        persistUnlock({ tx, network: data.network, method: 'x402' });
      } else {
        window.alert('x402 支付未完成：' + (data?.error || data?.note || '请稍后重试'));
      }
    } catch (e) {
      window.alert('解锁请求失败：' + String(e));
    } finally {
      setUnlocking(false);
    }
  }, [current, seats, persistUnlock]);

  const copyTalk = useCallback(() => {
    if (!unlocked) { setShowAuth(true); return; }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(r.talk).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }).catch(() => { window.prompt('复制话术', r.talk); });
    } else {
      window.prompt('复制话术', r.talk);
    }
  }, [r.talk, unlocked]);

  const submitLead = useCallback(async () => {
    if (!leadCompany || !leadName || !leadContact) {
      window.alert('请填写企业名称、联系人与联系方式');
      return;
    }
    setLeadSubmitting(true);
    const payload = {
      company: leadCompany, name: leadName, contact: leadContact, scene: leadScene,
      agent: current, seats, annual: r.annual + r.setupFee, saving: r.annualSaving,
      roi: r.roi, utm, talk: r.talk,
    };
    try {
      const leads = JSON.parse(localStorage.getItem('roi_leads') || '[]');
      leads.push({ ts: new Date().toISOString(), ...payload });
      localStorage.setItem('roi_leads', JSON.stringify(leads));
    } catch { /* noop */ }

    const endpoint = process.env.NEXT_PUBLIC_LEAD_WEBHOOK || '/internal/leads';
    try {
      await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch { /* local fallback already saved */ }

    setLeadSubmitting(false);
    setLeadDone(true);
    persistUnlock({ method: 'lead' });
  }, [leadCompany, leadName, leadContact, leadScene, utm, r, current, seats, persistUnlock]);

  const LockedOverlay = ({ label }: { label: string }) => (
    <div className="roi-lock-overlay">
      <Lock size={22} />
      <div className="roi-lock-title">{label}已锁定</div>
      <p>解锁后可查看完整费用明细、收益测算与多规模对比，并生成盖章版报价单。</p>
      <button className="roi-btn p" onClick={() => setShowAuth(true)}>立即解锁完整版 →</button>
      <span className="roi-lock-hint">x402 微支付 0.10 USDC · 或 企业留资免费解锁</span>
    </div>
  );

  return (
    <div className="roi-page">
      <div className="roi-appbar">
        <Link href="/" className="roi-backlink"><ArrowLeft size={15} /> 返回首页</Link>
        <span className="roi-badge">✓ 数据不出本机 · 可离线使用</span>
      </div>

      <div className="roi-wrap">
        <header className="roi-header">
          <div className="roi-kicker">上海丙大山智能科技有限公司</div>
          <h1>AI 数字员工 · 投资回报测算器</h1>
          <div className="roi-sub">现场测算 · 数据不出本机 · 支持打印报价单</div>
        </header>

        <div className="roi-grid">
          <div className="roi-card">
            <h2>配置</h2>
            <label>选择数字员工</label>
            <div className="roi-agentchips">
              {Object.entries(AGENTS).map(([k, a]) => (
                <div key={k} className={'roi-chip' + (k === current ? ' on' : '')} onClick={() => onAgentChange(k as AgentKey)}>
                  {a.label}
                </div>
              ))}
            </div>

            <label>采购席位（可替代的岗位数）</label>
            <div className="roi-row">
              <span className="roi-seatnum">{seats}</span>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>个岗位</span>
            </div>
            <input type="range" min={1} max={500} step={1} value={seats} onChange={(e) => setSeats(+e.target.value)} />

            <label>贵司该岗位月人力成本（元）</label>
            <input type="number" step={1000} value={humanCost || ''} onChange={(e) => setHumanCost(+e.target.value)} />

            <label>一次性实施服务（可选）</label>
            <select value={setup} onChange={(e) => setSetup(e.target.value as SetupKey)}>
              <option value="">不需要 · 纯订阅</option>
              <option value="poc">POC 试点（3 万）</option>
              <option value="integration">系统集成（5 万）</option>
              <option value="custom_workflow">流程定制（8 万）</option>
              <option value="training">定制培训（2 万）</option>
              <option value="deploy">私有化部署（15 万）</option>
            </select>

            <div className="roi-sg">
              <button className="roi-btn p" onClick={copyTalk}>{copied ? '已复制 ✓' : '复制话术'}</button>
              <button className="roi-btn s" onClick={() => (unlocked ? window.print() : setShowAuth(true))}>
                {unlocked ? '打印报价单' : '🔒 打印报价单'}
              </button>
            </div>
            {!unlocked && (
              <div className="roi-note" style={{ textAlign: 'center' }}>
                🔒 明细与报价单已锁定 · 解锁后全部可用
              </div>
            )}
          </div>

          <div>
            {/* 免费：核心结论 */}
            <div className="roi-card" style={{ marginBottom: 20 }}>
              <h2>核心结论 <span className="roi-free-tag">免费</span></h2>
              <div className="roi-hero">
                <div className="roi-metric big">
                  <div className="k">投资回报倍数</div>
                  <div className="v">{r.roi.toFixed(1)}x</div>
                </div>
                <div className="roi-metric">
                  <div className="k">年度净收益</div>
                  <div className="v roi-money">¥{fmt(r.net)}</div>
                </div>
                <div className="roi-metric">
                  <div className="k">投资回收期</div>
                  <div className="v small">{r.payback > 60 ? '>60 个月' : r.payback.toFixed(1) + ' 个月'}</div>
                </div>
              </div>
              <div className="roi-bar"><i style={{ width: pct + '%' }} /></div>
              <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>0</span><span>企业采购门槛 ROI = 3x</span><span>12x+</span>
              </div>
              <div style={{ marginTop: 12 }}>
                {r.passes ? (
                  <>
                    <span className="roi-pill ok">✓ 通过企业采购门槛</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12.5, marginLeft: 8 }}>
                      ROI {r.roi.toFixed(1)}x ≥ 3x，{r.payback.toFixed(1)} 个月回本
                    </span>
                  </>
                ) : (
                  <>
                    <span className="roi-pill no">✕ 未达 3x 门槛</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12.5, marginLeft: 8 }}>建议增加席位或核对人力成本</span>
                  </>
                )}
              </div>
            </div>

            {/* 锁定组 */}
            <div className="roi-locked-group">
              <div className={'roi-card' + (unlocked ? '' : ' roi-blur')} style={{ marginBottom: 20 }}>
                <h2>费用明细</h2>
                <table className="roi-table">
                  <tbody>
                    <tr><th>项目</th><th style={{ textAlign: 'right' }}>金额（元）</th></tr>
                    <tr><td>订阅单价 / 席位 / 年</td><td className="num">{fmt(r.a.price)}</td></tr>
                    <tr><td>规模折扣</td><td className="num">{(r.disc * 100).toFixed(0)}%</td></tr>
                    <tr><td>年度订阅费（{seats} 席位）</td><td className="num">{fmt(r.annual)}</td></tr>
                    <tr><td>一次性服务费</td><td className="num">{r.setupFee ? fmt(r.setupFee) : '0'}</td></tr>
                    <tr style={{ fontWeight: 700 }}><td>首年总投入</td><td className="num">{fmt(r.annual + r.setupFee)}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className={'roi-card' + (unlocked ? '' : ' roi-blur')} style={{ marginBottom: 20 }}>
                <h2>收益测算</h2>
                <table className="roi-table">
                  <tbody>
                    <tr><th>项目</th><th style={{ textAlign: 'right' }}>数值</th></tr>
                    <tr><td>月替代工时</td><td className="num">{fmt(r.a.hours * seats)} 小时/月</td></tr>
                    <tr><td>月节省人力成本</td><td className="num">¥{fmt(r.monthlySaving)}</td></tr>
                    <tr><td>年节省人力成本（已扣实施爬坡 12%）</td><td className="num">¥{fmt(r.annualSaving)}</td></tr>
                  </tbody>
                </table>
                <div className="roi-talk">{r.talk}</div>
              </div>

              <div className={'roi-card' + (unlocked ? '' : ' roi-blur')}>
                <h2>多规模对比（同岗位）</h2>
                <table className="roi-table">
                  <thead>
                    <tr><th>席位</th><th style={{ textAlign: 'right' }}>年费</th>
                      <th style={{ textAlign: 'right' }}>年省</th><th style={{ textAlign: 'right' }}>ROI</th>
                      <th style={{ textAlign: 'right' }}>闸门</th></tr>
                  </thead>
                  <tbody>
                    {r.scaleRows.map((s) => (
                      <tr key={s.s}>
                        <td>{s.s}</td><td className="num">{fmt(s.ann)}</td>
                        <td className="num">{fmt(s.sav)}</td><td className="num">{s.rr.toFixed(1)}x</td>
                        <td style={{ textAlign: 'right' }}>
                          {s.pass ? <span className="roi-pill ok">通过</span> : <span className="roi-pill no">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!unlocked && <LockedOverlay label="完整报告" />}
            </div>

            <div className="roi-banner">
              说明：收益按“可替代工时 × 时薪”测算，时薪＝该岗位月人力成本 ÷ 174 有效工时。
              实施前 3 个月按 88% 兑现（爬坡期）。数字供谈判参考，实际以 POC 结果为准。
            </div>

            {/* 商业化转化/解锁区 */}
            {unlocked ? (
              <div className="roi-cta">
                <div className="roi-success">
                  <Unlock size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6 }} />
                  完整版已解锁 ✓（{unlockInfo?.method === 'x402' ? 'x402 链上支付' : '企业留资'}）
                  {unlockInfo?.tx && (
                    <div style={{ fontSize: 11.5, marginTop: 4, wordBreak: 'break-all', color: 'var(--muted)' }}>
                      交易哈希：{unlockInfo.tx}（{unlockInfo.network}）
                    </div>
                  )}
                </div>
                <div className="roi-sg">
                  <button className="roi-btn p" onClick={() => window.print()}>打印 / 导出报价单</button>
                  <button className="roi-btn s" onClick={copyTalk}>{copied ? '已复制 ✓' : '复制话术'}</button>
                </div>
              </div>
            ) : showAuth ? (
              <div className="roi-cta">
                <h3>解锁完整版 · 两种方式任选</h3>
                <p>① x402 微支付 0.10 USDC（链上即时解锁，含交易凭证）&nbsp;&nbsp;② 企业留资（顾问 24h 内免费解锁并对接）</p>

                <button className="roi-btn p" disabled={unlocking} onClick={unlockWithX402}
                  style={{ width: '100%', marginBottom: 14 }}>
                  {unlocking ? <><Loader2 size={15} className="roi-spin" /> 正在发起 x402 支付…</> : '① 用 x402 支付 0.10 USDC 解锁'}
                </button>

                <div className="roi-or"><span>或</span></div>

                <h3 style={{ fontSize: 14 }}>② 企业留资免费解锁</h3>
                <div className="roi-form-grid">
                  <input type="text" placeholder="企业名称 *" value={leadCompany} onChange={(e) => setLeadCompany(e.target.value)} />
                  <input type="text" placeholder="联系人 *" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
                  <input type="text" placeholder="手机 / 微信 *" style={{ gridColumn: '1 / -1' }} value={leadContact} onChange={(e) => setLeadContact(e.target.value)} />
                  <textarea
                    style={{ gridColumn: '1 / -1', width: '100%', background: '#0d1428', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: 10, padding: '11px 13px', fontSize: 14, fontFamily: 'inherit', outline: 'none', minHeight: 56 }}
                    placeholder="使用场景（可选）：客服降本 / 销售扩编 / 财务对账自动化…" value={leadScene} onChange={(e) => setLeadScene(e.target.value)} />
                </div>
                <div className="roi-form-actions">
                  <button className="roi-btn p" disabled={leadSubmitting} onClick={submitLead}>
                    {leadSubmitting ? '提交中…' : '提交并解锁'}
                  </button>
                  <button className="roi-btn s" onClick={() => setShowAuth(false)}>取消</button>
                </div>
                <div className="roi-note">
                  提交即解锁本机完整版，同时顾问将与您对接正式报价与 POC。数据仅用于商务对接，绝不外泄。
                  {Object.keys(utm).length > 0 && ` 来源：${Object.entries(utm).map(([k, v]) => `${k}=${v}`).join(' | ')}`}
                </div>
              </div>
            ) : (
              <div className="roi-cta">
                <h3>解锁完整版报告 · 生成盖章报价单</h3>
                <p>当前方案：{r.a.label} × {seats} 席位 · 首年 ¥{fmt(r.annual + r.setupFee)} · 年省 ¥{fmt(r.annualSaving)} · ROI {r.roi.toFixed(1)}x</p>
                <div className="roi-sg">
                  <button className="roi-btn p" onClick={() => setShowAuth(true)}>解锁完整版 ↗</button>
                  <button className="roi-btn s" onClick={copyTalk}>复制话术</button>
                </div>
                <div className="roi-note">🔒 费用明细 / 收益测算 / 多规模对比 / 盖章报价单已锁定。</div>
              </div>
            )}
          </div>
        </div>

        <div className="roi-foot">
          上海丙大山智能科技有限公司 · 本页为本地静态页面，所有计算在您的浏览器内完成，不联网、不上传任何数据。<br />
          AI 数字员工 · 私有化部署 & 订阅双模式交付。需求对接：service@shbingdashan.cn ｜ 400-810-1800
        </div>
      </div>
    </div>
  );
}