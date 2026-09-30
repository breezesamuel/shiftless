import type { Metadata } from "next";
import { GeoSubOrder } from "@/components/GeoSubOrder";

export const metadata: Metadata = {
  title: "季度复审订阅 — 三个季度的 AI 可见度曲线",
  description:
    "每季自动复审你的官网 AI 可读性，与上一季逐项对比，给你三个季度的分数曲线与回归预警。不卖排名，只报告可复现的变化。",
  robots: { index: false, follow: false },
};

const STEPS = [
  {
    t: "首季：建立基线",
    d: "自动发现你官网 6-8 个关键页面，逐页跑 11 项检查，落一份基线快照。这一份之后永远是你的对照基准。",
  },
  {
    t: "每季：自动复审并对比",
    d: "同一批页面重跑一遍，逐项与上一季对比：哪些已修复、哪些退步、哪些是新冒出来的。只报告变化，不重复堆砌没变的项。",
  },
  {
    t: "任一季：给你曲线",
    d: "累积三个季度后，你会得到一条自己的分数曲线——竞对拿不到这个，因为它只有现在这一份分数。",
  },
];

export default function GeoSubscribePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            AI 可见度审计
          </span>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="/geo" className="hover:text-slate-900">单次报告</a>
            <a href="#how" className="hover:text-slate-900">怎么运作</a>
            <a href="#order" className="hover:text-slate-900">订阅</a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section id="how" className="mx-auto max-w-6xl px-6 py-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              一次审计是一张快照。订阅给你的是一条曲线。
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              单次报告告诉你「现在多少分」。它不告诉你两件事：上季度是多少分，
              以及你上季度做的改动到底有没有用。季度复审订阅就是为了补上这两点——
              每季自动重跑同一批页面，逐项对比上一季，并把累积的变化画成曲线。
            </p>
            <p className="mt-3 text-sm text-slate-500">
              依然不承诺任何排名。模型输出是采样的，我们只报告可复现的输入侧分数变化。
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.t} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-xs font-semibold text-slate-400">第 {i + 1} 步</div>
                <h2 className="mt-1.5 font-semibold text-slate-900">{s.t}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="font-semibold text-slate-900">为什么这条曲线值钱</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
              <li>
                • <span className="font-medium text-slate-900">基线是你的资产。</span>
                {" "}
                首季那份快照会被留存，之后每一季都拿它做对照。别人只能给你当前分数。
              </li>
              <li>
                • <span className="font-medium text-slate-900">回归会被抓到。</span>
                {" "}
                改完某处导致别处掉分，季度对比会把它单独列出来；只测一次是发现不了的。
              </li>
              <li>
                • <span className="font-medium text-slate-900">报告只列变化项。</span>
                {" "}
                没变的项不重复占篇幅，你打开就能看到这季该动哪里。
              </li>
            </ul>
          </div>
        </section>

        <section id="order" className="mx-auto max-w-6xl px-6 pb-16">
          <div className="grid gap-6 lg:grid-cols-2">
            <GeoSubOrder />
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-600">
              <h3 className="text-lg font-semibold text-slate-900">先看样板再决定</h3>
              <p className="mt-3">
                我们公开吉客云 35/100、卖家精灵 52/100 的一页样板，测评项、权重、扣分理由
                都写在里面，不藏。你可以直接对着样板判断这个分数对你有没有意义。
              </p>
              <p className="mt-3">
                如果你只想测一次，不需要订阅，直接下单单次报告即可；订阅是从第二个季度开始体现价值的。
              </p>
              <p className="mt-3">
                取消：每季结束前书面通知下季不续即可，无违约条款。已交付季次不退。
              </p>
              <p className="mt-3 text-xs text-slate-500">
                付款方式与单次报告一致：转账并备注订单号，我们人工确认后开始建立基线。
                本页面不自动发送邮件。
              </p>
              <a
                href="/geo"
                className="mt-5 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                改看单次报告（¥1999）
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        我们测量的是输入侧可读性，并如实报告分数变化；不预测、不承诺任何模型输出排名。
      </footer>
    </div>
  );
}
