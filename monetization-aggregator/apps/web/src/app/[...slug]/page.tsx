import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Rocket, FileText, Code2, BookOpen, Users, Newspaper, Shield,
  Cookie, Scale, ScrollText, Award, LayoutDashboard, ArrowRight, Home,
} from 'lucide-react';

type Content = {
  title: string;
  kicker: string;
  body: string[];
  cta?: { label: string; href: string };
};

const PAGES: Record<string, { icon: typeof FileText; content: Content }> = {
  '/docs': {
    icon: BookOpen,
    content: {
      title: 'API 文档',
      kicker: 'Developers',
      body: [
        'BoostAI 提供 x402 协议付费 API、AI 技能与聚合工具。所有受保护端点遵循 HTTP 402 规范：客户端收到 402 后读取 PaymentRequired，按 EIP-3009 离线签名，经 facilitator 结算后携带 x402-payment 头重试即可。',
        '接入只需一行中间件；facilitator 代付链上 gas，开发者无需持有 ETH。支持 Base、Solana、Algorand 多链。',
      ],
      cta: { label: '查看 x402 规范', href: 'https://docs.x402.org' },
    },
  },
  '/developers/sdks': {
    icon: Code2,
    content: {
      title: 'SDK',
      kicker: 'Developers',
      body: [
        '官方 SDK 覆盖 TypeScript / Python / Go，封装了 EIP-3009 签名构造、nonce 管理与 facilitator 结算重试流程。',
        'x402 客户端 SDK 自动处理 402 协商、金额精度与超时重试；服务端 SDK 提供一行中间件即可为任意端点加收费墙。',
      ],
      cta: { label: 'SDK 文档', href: 'https://docs.x402.org' },
    },
  },
  '/about': {
    icon: Users,
    content: {
      title: '关于我们',
      kicker: 'Company',
      body: [
        'BoostAI 是面向开发者与 AI Agent 的变现基础设施：把「按次付费」「技能市场」「推荐分成」「API 聚合」收敛到同一平台。',
        '我们相信 AI Agent 需要原生的机器支付能力——没有账号、没有 KYC、没有预充值的按次结算，是 Agent 经济的前提。',
      ],
    },
  },
  '/blog': {
    icon: Newspaper,
    content: {
      title: '博客',
      kicker: 'Company',
      body: [
        '我们记录 x402 协议实践、Agent 支付架构、稳定币结算与自建付费 API 的完整落地过程。',
        '所有内容均来自真实线上闭环数据，包括交易哈希与可复现的验证步骤。',
      ],
    },
  },
  '/careers': {
    icon: Users,
    content: {
      title: '加入我们',
      kicker: 'Company',
      body: [
        '我们在招募熟悉 Web3 支付、分布式系统与 AI Agent 基础设施的工程师。',
        '如果你对「让 AI 自己付钱」这件事有兴趣，欢迎联系。',
      ],
      cta: { label: '投递简历', href: 'mailto:hello@highkingflower.com' },
    },
  },
  '/press': {
    icon: FileText,
    content: {
      title: '媒体资料',
      kicker: 'Company',
      body: [
        '媒体与评测合作请联系 press@highkingflower.com，我们可提供产品截图、架构图、交易数据与创始人署名信息。',
        '技术类内容欢迎直接引用，我们遵循 CC BY 4.0 并要求注明出处。',
      ],
      cta: { label: '发送邮件', href: 'mailto:hello@highkingflower.com' },
    },
  },
  '/privacy': {
    icon: Shield,
    content: {
      title: '隐私政策',
      kicker: 'Legal',
      body: [
        '我们只收集为提供服务所必需的数据：账户邮箱、API 调用计费记录与您主动提交的咨询表单内容。',
        'ROI 测算器等工具类页面的计算全部在您浏览器本地完成，不上传任何输入数据。',
        '我们不出售个人信息，不向第三方共享您的数据。您可随时联系我们请求导出或删除。',
      ],
      cta: { label: '联系我们', href: 'mailto:hello@highkingflower.com' },
    },
  },
  '/terms': {
    icon: Scale,
    content: {
      title: '服务条款',
      kicker: 'Legal',
      body: [
        '本平台提供按次计费的 API 接入与工具服务。使用即表示您同意按公布的价格支付，并遵守适用法律法规。',
        '我们按「尽力而为」原则提供服务，不保证端点 100% 可用；因链上拥堵或第三方 facilitator 异常导致的服务中断，我们不承担相应责任。',
        '任何试图绕过付费校验、滥用免费额度或攻击服务的行为将被终止服务并保留追责权利。',
      ],
    },
  },
  '/cookies': {
    icon: Cookie,
    content: {
      title: 'Cookie 政策',
      kicker: 'Legal',
      body: [
        '我们仅使用必要的会话 Cookie 维持登录状态与偏好设置，不投放跨站广告追踪 Cookie。',
        '您可以在浏览器设置中清除 Cookie，但清除后需重新登录。',
      ],
    },
  },
  '/security': {
    icon: Shield,
    content: {
      title: '安全',
      kicker: 'Legal',
      body: [
        '所有受保护端点在返回内容前必须完成链上结算验证，未结算的请求一律拒绝签发。',
        '我们不对私钥进行任何形式的存储；签名仅发生在您的钱包或本地客户端。报告安全问题请发送至 security@highkingflower.com。',
      ],
      cta: { label: '报告漏洞', href: 'mailto:hello@highkingflower.com' },
    },
  },
  '/licenses': {
    icon: ScrollText,
    content: {
      title: '许可与开源',
      kicker: 'Legal',
      body: [
        'x402 协议与 Bazaar 工具链遵循 Apache 2.0 / MIT 开源许可，鼓励社区自由集成。',
        '我们的付费 API 端点本身是商业服务，但其实现方式完全公开，任何人都可自建等价设施。',
      ],
      cta: { label: 'Paywall 模板', href: 'https://github.com/breezesamuel/x402-paywall' },
    },
  },
  '/audit': {
    icon: Award,
    content: {
      title: '透明与审计',
      kicker: 'Trust',
      body: [
        '我们公开每一笔链上结算的凭证。任何一笔付费请求都对应一个可验证的交易哈希，可在 Base 区块浏览器独立复核。',
        '我们相信可验证性比承诺更可信——欢迎自行验证我们的收款地址与每一笔结算记录。',
      ],
    },
  },
  '/dashboard': {
    icon: LayoutDashboard,
    content: {
      title: '控制台',
      kicker: 'Dashboard',
      body: [
        '控制台提供 API 用量、收入统计、密钥管理与结算记录。当前为早期预览，账户体系即将开放。',
        '在此之前，您可以直接调用 x402 付费端点，或使用 AI 数字员工 ROI 测算器生成正式报价。',
      ],
      cta: { label: 'ROI 测算器', href: '/roi' },
    },
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((path) => ({ slug: path.slice(1).split('/') }));
}

export async function generateMetadata({ params }: { params: { slug: string[] } }): Promise<Metadata> {
  const p = PAGES['/' + params.slug.join('/')];
  if (!p) return { title: '页面不存在' };
  return {
    title: `${p.content.title} · BoostAI`,
    description: p.content.body[0]?.slice(0, 150),
  };
}

export default function CatchAllPage({ params }: { params: { slug: string[] } }) {
  const path = '/' + params.slug.join('/');
  const entry = PAGES[path];
  if (!entry) notFound();
  const { icon: Icon, content } = entry;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 flex-1">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-500 mb-10">
          <Home size={15} /> 返回首页
        </Link>

        <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:border-primary-900 dark:bg-primary-500/10 dark:text-primary-300">
          <Icon size={13} /> {content.kicker}
        </div>

        <h1 className="mt-5 text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
          {content.title}
        </h1>

        <div className="mt-8 space-y-5">
          {content.body.map((p, i) => (
            <p key={i} className="text-[15px] leading-7 text-gray-600 dark:text-gray-300">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {content.cta && (
            <a
              href={content.cta.href}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-600 transition-colors"
            >
              {content.cta.label} <ArrowRight size={15} />
            </a>
          )}
          <Link
            href="/roi"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:border-primary-400 hover:text-primary-600 transition-colors dark:border-gray-700 dark:text-gray-300"
          >
            <Rocket size={15} /> AI 数字员工 ROI 测算
          </Link>
        </div>
      </div>
    </div>
  );
}
