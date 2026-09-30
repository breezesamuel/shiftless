import type { Metadata } from "next";
import { GeoOrder } from "@/components/GeoOrder";

export const metadata: Metadata = {
  title: "AI 可见度审计 — 你的官网对 GPT、豆包、Kimi 有多易读？",
  description:
    "实测你官网对 13 个主流 AI 爬虫的可读性，0–100 分，11 项检查，分数可复现。不卖「排名保证」，只卖可执行的真话。",
  robots: { index: false, follow: false },
};

export default function GeoAuditPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            AI 可见度审计
          </span>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#what" className="hover:text-slate-900">是什么</a>
              <a href="#samples" className="hover:text-slate-900">样板</a>
              <a href="/geo/subscribe" className="hover:text-slate-900">订阅</a>
              <a href="#order" className="hover:text-slate-900">下单</a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* What */}
        <section id="what" className="mx-auto max-w-6xl px-6 py-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              当客户在问 AI 而不是问百度，你的官网能被读懂吗？
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              DeepSeek、豆包、Kimi、ChatGPT、Gemini 会从「它读得懂的地方」取材作答。
              本服务实测你的官网对 AI 的可读性：13 个主流 AI 爬虫是否放行、
              有无结构化数据、有没有模型最常引用的问答格式——给你一个 0–100
              可复现的分数，和一行行改哪里。
            </p>
            <p className="mt-3 text-sm text-slate-500">
              分数可复现：重新扫描结果不变。不做任何「排名保证」——模型输出是采样的，
              没人能保证排名；保证排名的人卖的是他控制不了的东西。
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                t: "11 项检查，权重透明",
                d: "爬虫放行、JSON-LD、FAQ schema、问题式标题、署名日期、OG 元数据……每一项权重公开，为什么扣分、扣多少都写清。",
              },
              {
                t: "全站多页面，不是只测首页",
                d: "自动发现你的关键页面逐页打分，聚合出全站分数。首页好看、其他页裸奔，是多数站点的问题——只测首页的报告发现不了。",
              },
              {
                t: "48 小时交付 + 一次复查",
                d: "标准档 48 小时内发 Markdown 报告。整改档加一份贴代码的改法建议，改完我复查一次，验证分数变化。",
              },
            ].map((c) => (
              <div key={c.t} className="rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900">{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Samples — the proof, public, identical to what we hand out */}
        <section id="samples" className="border-t border-slate-200 bg-slate-50 py-14">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              已公开实测样板
            </h2>
            <p className="mt-2 max-w-3xl text-slate-600">
              客户收到的就是这份格式。数字来自实测，可复现，不是广告语气。
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <a
                href="/geo/samples/jackyun"
                className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-900"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-slate-900">吉客云 jackyun.com</span>
                  <span className="text-2xl font-bold text-slate-900">35/100</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  首页实测。6 页全站扫描聚合 41/100。
                </p>
              </a>
              <a
                href="/geo/samples/sellersprite"
                className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-900"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-slate-900">卖家精灵 sellersprite.com</span>
                  <span className="text-2xl font-bold text-slate-900">52/100</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  全站聚合 62/100；其 /en/ 67、/jp/ 76 分高于 /cn/——差距即整改点。
                </p>
              </a>
            </div>
          </div>
        </section>

        {/* Why not ranking guarantees — our real moat */}
        <section className="border-t border-slate-200 bg-white py-14">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              为什么我们不卖「排名保证」，卖的是可验证的输入侧条件
            </h2>
            <p className="mt-3 max-w-3xl text-slate-600">
              对 1,749 家死掉公司、$535B 烧钱的结构化分析显示：<strong>48% 的 AI 公司死于竞争</strong>，
              其中大量死于「能力被平台方做成原生 feature」。我们不打「分数更高」这场仗，也不承诺任何 AI
              答案里的排名——模型输出是采样的，没人能保证排名；保证排名的人卖的是他控制不了的东西。
            </p>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                {
                  t: "可复现 + 快照存档 = 时间护城河",
                  d: "quarterly.js 每季度留一份基线快照。竞对只能给你一份当前分数，我们给你的是「你三个季度的变化曲线」。订阅制的真正价值不是再测一次，是沉淀出别人无法追溯重建的历史。",
                },
                {
                  t: "白标 15% 分成 = 抗集中度风险",
                  d: "SVB/WeWork 的教训：单一渠道/客群是存在性风险。白标模式把竞争维度从『谁获客』换成『谁有渠道网络』。代理商持有客户关系与品牌，我们收 15% 实收分成。",
                },
                {
                  t: "垂直到平台不屑做 = 安全区",
                  d: "平台不会为『¥1,999 帮中国 B2B 卖家改 JSON-LD』做原生 feature。越窄越安全；越通用越容易被碾。我们只做可读性审计、可执行整改、季度复审，这三件事。",
                },
              ].map((c) => (
                <div key={c.t} className="rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900">{c.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.d}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                <strong>诚实边界：</strong>本服务只测「对 AI 引擎的可读性」。我们不预测、也不声称任何 AI 答案里的排名或收录。
                分数是输入侧的可执行条件，不是结果承诺。任何「保证排名」的承诺都产自你无法验证的采样输出。
              </p>
            </div>
          </div>
        </section>

        {/* Order */}
        <section id="order" className="border-t border-slate-200 bg-white py-14">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">下单</h2>
            <p className="mt-2 mb-6 text-slate-600">
              先看样板，再决定买不买。转账对公/微信/支付宝均可，备注订单号即可。
            </p>
            <div className="mb-6 rounded-2xl border border-slate-900 bg-slate-50 p-5">
              <h3 className="font-semibold text-slate-900">
                只想偶尔测一次？直接下单单次报告。
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                要长期盯回归，订阅更划算：10 次免费起步，之后 ¥60/月、¥150/季、¥500/年
                （或 $9.9 / $25 / $99），并含季度对比与分数曲线。
              </p>
              <a
                href="/geo/subscribe"
                className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                查看订阅方案 →
              </a>
            </div>
            <GeoOrder />
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-sm text-slate-500">
        <div className="mx-auto max-w-6xl px-6">
          <p>
            本审计测量的是可读性，不是排名。分数可复现；任何「保证排名」的承诺都产自
            你无法验证的采样输出。
          </p>
        </div>
      </footer>
    </div>
  );
}