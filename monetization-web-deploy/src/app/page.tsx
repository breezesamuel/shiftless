import Link from 'next/link';
import {
  AGENTS,
  SETUP,
  MIN_SEATS_FOR_SALE,
  CONTACT,
  quote,
  type AgentKey,
} from '@/lib/pricing';

const fmt = (n: number) => '¥' + Math.round(n).toLocaleString('zh-CN');

// Every figure below is computed from the same quote() used by the ROI calculator and
// the pricing page, so the three can never disagree.
// Range is deliberately capped: the model amortises one fixed setup fee over seats, so
// large-seat ROI keeps climbing on a fixed-fee artefact rather than on new value. We stop
// at 10 seats instead of showing 50-seat numbers no real buyer will believe.
const ROLES: AgentKey[] = ['customer_service', 'sales', 'operations', 'finance', 'hr'];
const SCALE = [1, 3, 5, 10];

export default function HomePage() {
  const cs = (seats: number) => quote('customer_service', seats, 'integration');
  const rows = SCALE.map((s) => ({ s, q: cs(s) }));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/85 backdrop-blur dark:border-gray-800 dark:bg-gray-950/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="BoostAI 首页">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 text-lg font-bold text-white">
              B
            </span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              Boost<span className="text-primary-500">AI</span>
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium" aria-label="主导航">
            <Link href="/cs" className="text-gray-600 hover:text-primary-600 dark:text-gray-300">
              客服 ROI 测算
            </Link>
            <Link href="/pricing" className="text-gray-600 hover:text-primary-600 dark:text-gray-300">
              价目表
            </Link>
            <Link href="/roi" className="text-gray-600 hover:text-primary-600 dark:text-gray-600 dark:hover:text-primary-400">
              测算器
            </Link>
            <Link
              href="/order"
              className="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
            >
              提交需求
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            AI 数字员工，
            <span className="text-primary-600 dark:text-primary-400">按席位订阅</span>
            ，一次算清回本账
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            销售、客服、运营、财务、招聘——五个岗位，公开价目表，不做「效果再谈」。
            费用只有两项：每席年费 + 一次性实施费。ROI 用你自己的工单量在线算。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/cs"
              className="rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700"
            >
              按我的工单量算一次
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
            >
              看公开价目表
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            先做 4 周概念验证（POC，{fmt(SETUP.poc.fee)}）：不达标退一半，这笔钱可抵扣正式实施费。
          </p>
        </section>

        {/* 规模表 */}
        <section className="border-y border-gray-200 bg-white py-14 dark:border-gray-800 dark:bg-gray-900/40">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              规模越大越划算——但只有工单量撑得住才行
            </h2>
            <p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-300">
              下表以 AI 客服员为例，实施费按 {fmt(SETUP.integration.fee)} 系统集成计。
              前提是每个席位都有做不完的活；工单量不足时请用
              <Link href="/cs" className="mx-1 font-medium text-primary-600 underline dark:text-primary-400">
                客服测算器
              </Link>
              填真实工单量——席位买多了 ROI 会明显下降。
            </p>
            <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">席位数</th>
                    <th className="px-4 py-3 text-right font-semibold">年费合计</th>
                    <th className="px-4 py-3 text-right font-semibold">首年总投入</th>
                    <th className="px-4 py-3 text-right font-semibold">年省人力</th>
                    <th className="px-4 py-3 text-right font-semibold">ROI</th>
                    <th className="px-4 py-3 text-right font-semibold">回收期</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ s, q }) => (
                    <tr key={s} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3 font-medium">
                        {s} 席
                        {s < MIN_SEATS_FOR_SALE && (
                          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                            不建议
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(q.annualFee)}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(q.firstYear)}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(q.saving)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-primary-600 dark:text-primary-400">
                        {q.roi.toFixed(2)}x
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{q.paybackMonths.toFixed(1)} 月</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              口径：月工作 {174} 小时、年化爬坡 88%、席位规模效应上限 1.15 倍。数字与
              <Link href="/pricing" className="mx-1 underline">价目表</Link>、
              <Link href="/roi" className="mx-1 underline">测算器</Link>同源。
            </p>
          </div>
        </section>

        {/* 岗位 */}
        <section className="py-14">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">五个岗位</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ROLES.map((k) => {
                const a = AGENTS[k];
                const one = quote(k, 1, 'integration');
                const three = quote(k, 3, 'integration');
                return (
                  <div
                    key={k}
                    className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900/40"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{a.label}</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      对标人工月薪 {fmt(a.human)} · AI {fmt(a.price)}/席/年
                    </p>
                    <dl className="mt-4 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">单席年省</dt>
                        <dd className="font-mono">{fmt(one.saving)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">3 席投入产出</dt>
                        <dd className="font-mono font-semibold text-primary-600 dark:text-primary-400">
                          {three.roi.toFixed(2)}x
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 诚实说明 */}
        <section className="border-t border-gray-200 py-14 dark:border-gray-800">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">先说清楚三件事</h2>
            <ul className="mt-5 space-y-3 text-gray-700 dark:text-gray-300">
              <li>
                <b>1 席我们不接。</b>固定实施费基本全压在 1 席上，ROI 只有{' '}
                {cs(1).roi.toFixed(2)}x、回本要 {cs(1).paybackMonths.toFixed(0)} 个月，
                风险几乎全在你这边。要做请从 {MIN_SEATS_FOR_SALE} 席起，
                同一笔实施费摊下来回本只要 {cs(3).paybackMonths.toFixed(1)} 个月。
              </li>
              <li>
                <b>我们是新团队，暂时没有可引用的客户案例。</b>所以本页不放 logo、不编「已节省多少」。
                愿意就先做 {fmt(SETUP.poc.fee)} 的 4 周 POC，用真实工单量验证自动化率。
              </li>
              <li>
                <b>本页价格是公开价目表，不含签章。</b>正式合同以双方签署盖章件为准。
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/order"
                className="rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700"
              >
                提交需求，24 小时内回复
              </Link>
              <a
                href={`https://weixin.qq.com/r/${CONTACT.wechat}`}
                className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-200"
              >
                微信 {CONTACT.wechat}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-8 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <div className="mx-auto max-w-6xl px-6">
          <p>BoostAI · 上海丙大山智能科技有限公司</p>
          <p className="mt-1">
            邮箱 {CONTACT.email} · 电话 {CONTACT.phone}
          </p>
          <p className="mt-1">
            <Link href="/pricing" className="underline">价目表</Link> ·{' '}
            <Link href="/cs" className="underline">客服 ROI 测算</Link> ·{' '}
            <Link href="/privacy" className="underline">隐私政策</Link> ·{' '}
            <Link href="/terms" className="underline">服务条款</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
