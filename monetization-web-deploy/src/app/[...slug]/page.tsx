import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CONTACT } from '@/lib/pricing';
import { FileText, Users, Shield, Scale, ScrollText, Home, ArrowRight } from 'lucide-react';

type Content = {
  title: string;
  kicker: string;
  body: string[];
  cta?: { label: string; href: string };
};

const PAGES: Record<string, { icon: typeof FileText; content: Content }> = {
  '/about': {
    icon: Users,
    content: {
      title: '关于我们',
      kicker: '公司',
      body: [
        'BoostAI 做 AI 数字员工：把销售、客服、运营、财务、招聘这几个岗位的重复工作，交给按席位订阅的 AI 员工来做，人只处理例外和判断。',
        '我们是一家新公司，所以网站上不放客户 logo、不编「已帮客户节省多少」。你能看到的价格表、ROI 口径和测算公式都是公开的，可以自己拿工单量复核。',
        '我们相信 AI 员工的价值不取决于模型多聪明，而取决于它能不能真的接住工单——所以第一步永远是拿你自己的数据做 4 周概念验证。',
      ],
    },
  },
  '/privacy': {
    icon: Shield,
    content: {
      title: '隐私政策',
      kicker: '法律',
      body: [
        '我们收集的数据只有一类：你主动提交的商务咨询信息（公司名称、联系人、联系方式、需求描述），用途仅限回复你的询盘和后续商务沟通。',
        'ROI 测算器、客服测算器等工具页面的计算全部在你的浏览器本地完成。你填的席位数、工单量、人力成本等参数不会上传到我们的服务器，也不会用于统计。',
        '只有当你主动点击提交时，表单内容才会发送到我方，并存入我们的线索记录用于跟进。',
        '我们不出售个人信息，不向第三方共享你的联系方式。数据存储在中国境内。你可随时发邮件要求查询、导出或删除，我们会在 15 个工作日内处理。',
      ],
      cta: { label: `邮件申请删除（${CONTACT.email}）`, href: `mailto:${CONTACT.email}` },
    },
  },
  '/terms': {
    icon: Scale,
    content: {
      title: '服务条款',
      kicker: '法律',
      body: [
        '订阅按「每席年费 + 一次性实施费」计费。实施费根据对接系统数量与私有化部署范围确定，具体金额在正式报价单中列明。网页上的价目表是公开参考价，正式合同以双方签署盖章件为准。',
        '概念验证（POC）为期 4 周。若在 POC 结束时未达到双方书面约定的验收指标（例如工单自动处理占比），我们退还 POC 费用的一半，该款项可直接抵扣正式实施费。',
        '订阅期内任一方提前 30 天书面通知可终止续费，已支付的年费按剩余月份折算退还，不另收解约费用。',
        '我们对 AI 员工的输出质量负责到底：因模型幻觉导致的对外错误发送，由我们承担返工成本。但 AI 不能替代您对最终对外沟通的审核责任，涉及合同、报价、承诺的事项请设置人工确认环节。',
      ],
    },
  },
  '/security': {
    icon: Shield,
    content: {
      title: '安全与部署',
      kicker: '信任',
      body: [
        '两种交付方式：公有云多租户，或在你的服务器上私有化部署。私有化部署下，客户的会话数据与工单数据不出你的内网。',
        '我们按最小权限原则分配席位账号，管理员可按岗位、按工单系统分别授权。账号停用、席位回收在合同终止或员工离职时由管理员操作。',
        '传输层全程加密，企业版支持与你的 SSO / AD 域账号打通。我们目前尚未通过第三方安全认证，我们不声称通过——如你有强制合规要求，请在合同前提出，我们配合你的安全评审。',
      ],
      cta: { label: '索取安全白皮书', href: `mailto:${CONTACT.email}` },
    },
  },
  '/licenses': {
    icon: ScrollText,
    content: {
      title: '许可与交付物',
      kicker: '法律',
      body: [
        '订阅期内，你获得所购席位的使用权，包含版本更新与技术支持。不含源代码，源码交付需单独协商。',
        '知识库与提示词配置归你所有。我们使用你的业务数据（工单历史、话术、产品资料）仅用于配置你的 AI 员工，不用于训练通用模型，训练用途需另行书面授权。',
        '第三方模型与组件的许可条款以其官方说明为准，我们不改变、不附加限制。',
      ],
    },
  },
  '/faq': {
    icon: FileText,
    content: {
      title: '常见问题',
      kicker: '售前',
      body: [
        'Q：为什么不接 1 席？\nA：实施费是固定的，摊到 1 席上 ROI 约 1.05 倍、回本要 10 个月，几乎没有容错空间；3 席起同一笔实施费摊下来回本约 4 个月。我们不做把风险全留给客户的单子。',
        'Q：POC 要多久、要准备什么？\nA：4 周。开始前请准备近 3 个月的真实工单导出和现有话术文档，这是能否给出可承诺自动化率的关键。',
        'Q：AI 会不会乱承诺？\nA：默认配置下，涉及合同、金额、承诺时效的内容会转人工确认。建议先在低风险工单上跑满一个周期再放开。',
        'Q：算错了谁承担？\nA：因模型输出错误导致的对外错误发送，返工成本由我们承担，条款见服务协议。',
      ],
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
    title: p.content.title,
    description: p.content.body[0]?.slice(0, 150),
  };
}

export default function CatchAllPage({ params }: { params: { slug: string[] } }) {
  const path = '/' + params.slug.join('/');
  const entry = PAGES[path];
  if (!entry) notFound();
  const { icon: Icon, content } = entry;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-500 dark:text-gray-400">
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
            <p key={i} className="whitespace-pre-line text-[15px] leading-7 text-gray-600 dark:text-gray-300">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {content.cta && (
            <a
              href={content.cta.href}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            >
              {content.cta.label} <ArrowRight size={15} />
            </a>
          )}
          <Link
            href="/order"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:border-primary-400 hover:text-primary-600 transition-colors dark:border-gray-700 dark:text-gray-300"
          >
            提交需求
          </Link>
        </div>
      </div>
    </div>
  );
}
