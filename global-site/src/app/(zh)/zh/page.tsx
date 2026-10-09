import type { Metadata } from "next";
import Link from "next/link";
import { Calculator } from "@/components/Calculator";
import { SITE_URL as BASE } from "@/lib/site";

/**
 * Chinese-language entry point.
 *
 * This exists because of a measured finding, not a hunch: the operator is in
 * Shanghai, but the site was English-only, so the one market where they have
 * distribution, payment rails, and credibility was structurally unreachable.
 * The calculator is the asset; the language was the missing piece.
 *
 * The page reuses the real Calculator component and the real model — no forked
 * math. Only the framing copy is localised, because the honest-calculator rules
 * (refuse to recommend automation below ~400 tickets/month, clamp coverage to
 * the industry ceiling, publish every constant) apply identically in Chinese.
 */

export const metadata: Metadata = {
  title: "客服团队编制测算器 — 你到底需要几个客服？AI 自动化值不值",
  description:
    "免费测算器：按你的真实工单量算出客服团队需要多少人、成本多少，以及在你的业务量级下 AI 自动化到底值不值得买。无需注册，即时出结果。",
  keywords: [
    "客服编制测算",
    "客服人数计算器",
    "客服成本计算器",
    "AI 客服自动化 回报",
    "电商客服成本",
    "工单量 人效",
  ],
  alternates: {
    canonical: "/zh",
    languages: {
      "zh-CN": "/zh",
      en: "/",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    siteName: "Shiftless",
    url: `${BASE}/zh`,
    locale: "zh_CN",
    title: "客服团队编制测算器 — 你到底需要几个客服？",
    description: "按真实工单量算编制、成本，以及 AI 自动化到底值不值得。免费，即时出结果。",
  },
};

export default function ZhPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight text-slate-900">Shiftless</span>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#calculator" className="hover:text-slate-900">测算器</a>
            <Link href="/zh/benchmarks" className="hover:text-slate-900">行业基准</Link>
            <a href="#faq" className="hover:text-slate-900">常见问题</a>
            <Link href="/geo" className="hover:text-slate-900">AI 可见度体检</Link>
            <Link href="/zh/tools" className="hover:text-slate-900">工具</Link>
            <Link href="/" className="hover:text-slate-900">English</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section id="calculator" className="mx-auto max-w-6xl px-6 py-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              你的客服团队到底需要几个人？
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              多数团队靠拍脑袋。估多了浪费人力成本，估少了客服被压垮、顾客流失。
              填入真实工单量，你就能拿到一个在预算会上站得住的区间 ——
              以及一个诚实的结论：在你目前的业务量级下，AI 自动化到底值不值得买。
            </p>
            <p className="mt-3 text-sm text-slate-500">
              无需注册，无需留邮箱。每个假设都可以改。而且当自动化并不划算时，
              这个工具会直接告诉你不要买。
            </p>
          </div>

          <div className="mt-8">
            <Calculator />
          </div>
        </section>

        {/* The three rules that make the number trustworthy. These are the same
            commitments the English page makes — a tool that only ever agrees is
            a sales brochure. */}
        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              为什么这个测算值得信
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div>
                <h3 className="font-semibold text-slate-900">它会劝你别买</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  每月工单低于约 400 条时，结论是「不值得」。
                  不会为了促单而反着说。
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">它会压住你的乐观</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  填 90% 自动化覆盖率会被限制在 62% 的行业上限，并解释原因。
                  漏算升级工单，是这类项目最常见的失望来源。
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">所有常数都公开</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  每个数字和公式都列出来，怀疑的人可以逐条反驳。
                  藏起假设的测算器就是销售宣传页。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-6 py-12">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">常见问题</h2>
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900">多久回本？</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                工具会直接给出回本月数。真正的 AI 客服平台按「每次自动解决的工单」计费，
                而不是按坐席席位计费——按席位收固定月费会算出离谱的回报率，
                那种数字一眼假。
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">能不能砍人？</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                不能马上砍。节约会通过人员自然流失分阶段体现，
                补偿金作为一次性成本单独计算。工具默认就是这么算的。
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">这个数据怎么用？</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                复制链接即可把当前这套参数分享给别人，链接里带着全部参数，
                对方打开看到的是和你完全一样的结果。
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-slate-500">
          <p>© Shiftless · 上海丙大山智能科技有限公司</p>
          <p className="mt-2">
            <Link href="/" className="hover:text-slate-900">English version</Link>
            <span className="mx-2">·</span>
            <Link href="/privacy" className="hover:text-slate-900">隐私</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
