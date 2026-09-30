import type { Metadata } from 'next';
import { ROICalculator } from '@/components/ROICalculator';

export const metadata: Metadata = {
  title: 'AI 数字员工 ROI 测算器 · 免费在线报价',
  description:
    '在线测算 AI 数字员工的投资回报倍数、年度净收益与回收期。AI 销售员 / 客服 / 运营 / 财务 / 招聘 五大岗位，支持打印报价单与预约免费 POC。数据不出本机。',
  keywords: ['AI数字员工', 'ROI测算', 'AI客服', 'AI销售', '投资回报计算', '私有化部署', '企业AI'],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    title: 'AI 数字员工 ROI 测算器 · 免费在线报价',
    description:
      '测算投资回报倍数与回收期，一键生成报价单并预约免费 POC。数据不出本机。',
    siteName: 'BoostAI',
  },
  twitter: {
    card: 'summary',
    title: 'AI 数字员工 ROI 测算器 · 免费在线报价',
    description: '测算投资回报倍数与回收期，一键生成报价单并预约免费 POC。',
  },
};

export default function ROIPage() {
  return <ROICalculator />;
}