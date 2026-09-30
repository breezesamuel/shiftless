import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Check, ArrowUpRight, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

const categoryIcons = {
  tools: '🔧',
  api: '🔌',
  skills: '🧠',
  hosting: '🚀',
  subscription_aggregation: '📦',
  bundled_services: '🔗',
  desktop_apps: '🖥️',
  productivity_suite: '📋',
  api_marketplace: '🔌',
};

interface Product {
  id: string;
  name: string;
  description: string;
  price: { amount: string; period: string; usd: string };
  features: string[];
  cta: string;
  href: string;
  external: boolean;
  live: boolean;
  stats: Record<string, string>;
  category: keyof typeof categoryIcons;
}

const products: Product[] = [
  {
    id: 'api_marketplace',
    name: 'RapidAPI',
    category: 'api_marketplace',
    description: 'Unified access to 10,000+ APIs via single subscription. AI-powered API discovery, unified billing, MCP-ready endpoints. Revenue share for API providers. White-label marketplace option.',
    price: { amount: '$49', period: '/month', usd: '$49' },
    features: [
      '10,000+ APIs unified',
      'AI-powered API discovery',
      'MCP-ready for agent access',
      'Revenue share for providers',
      'White-label marketplace',
      'Real-time usage analytics',
    ],
    cta: 'Explore APIs',
    href: 'https://rapidapi.com',
    external: true,
    live: true,
    stats: { apis: '10,000+', providers: '500+', uptime: '99.9%' },
  },
  {
    id: 'hosting',
    name: 'Vercel',
    category: 'hosting',
    description: 'Frontend cloud platform. Zero-config deployments, edge functions, ISR, analytics. Built for Next.js, React, Vue, Svelte.',
    price: { amount: '$20', period: '/month', usd: '$20' },
    features: [
      'Zero-config deployments',
      'Edge functions & ISR',
      'Analytics & speed insights',
      'Team collaboration',
      'Custom domains',
      'DDoS protection',
    ],
    cta: 'Deploy Free',
    href: 'https://vercel.com',
    external: true,
    live: true,
    stats: { deployments: '1M+', regions: '35+', uptime: '99.99%' },
  },
  {
    id: 'subscription_aggregation',
    name: 'Truebill (Rocket Money)',
    category: 'subscription_aggregation',
    description: 'Track, cancel, and negotiate subscriptions. Automated bill negotiation, credit monitoring, budgeting tools. 2M+ users.',
    price: { amount: 'Free', period: '', usd: '0' },
    features: [
      'Auto-cancel unused subs',
      'Bill negotiation service',
      'Credit score monitoring',
      'Spending insights',
      'Custom budgets',
      'Joint accounts',
    ],
    cta: 'Start Free',
    href: 'https://rocketmoney.com',
    external: true,
    live: true,
    stats: { users: '2M+', saved: '$500M+', rating: '4.8★' },
  },
  {
    id: 'bundled_services',
    name: 'Setapp',
    category: 'bundled_services',
    description: '240+ Mac/iOS apps for one subscription. Curated collection, no in-app purchases, offline access, family sharing.',
    price: { amount: '$9.99', period: '/month', usd: '$9.99' },
    features: [
      '240+ premium apps',
      'No in-app purchases',
      'Offline mode',
      'Family sharing (4 users)',
      'iOS + Mac sync',
      'New apps added monthly',
    ],
    cta: 'Try Free 7 Days',
    href: 'https://setapp.com',
    external: true,
    live: true,
    stats: { apps: '240+', platforms: 'Mac+iOS', rating: '4.7★' },
  },
  {
    id: 'desktop_apps',
    name: 'Raycast',
    category: 'desktop_apps',
    description: 'Lightning-fast launcher with extensions. Scripts, snippets, clipboard, window management, AI chat. Extensible via API.',
    price: { amount: 'Free', period: '', usd: '0' },
    features: [
      'Instant search & launch',
      'Clipboard history',
      'Window management',
      'AI chat (Pro)',
      'Custom scripts/extensions',
      'Keyboard-driven workflow',
    ],
    cta: 'Download Free',
    href: 'https://raycast.com',
    external: true,
    live: true,
    stats: { extensions: '1000+', users: '100k+', rating: '4.9★' },
  },
  {
    id: 'productivity_suite',
    name: 'Notion',
    category: 'productivity_suite',
    description: 'All-in-one workspace. Docs, wikis, projects, databases, AI writing. Team collaboration, templates, integrations.',
    price: { amount: '$10', period: '/month', usd: '$10' },
    features: [
      'Unlimited pages/blocks',
      'Databases & views',
      'AI writer (Plus)',
      'Team workspaces',
      'Templates gallery',
      'API & integrations',
    ],
    cta: 'Get Notion Free',
    href: 'https://notion.so',
    external: true,
    live: true,
    stats: { users: '20M+', templates: '10k+', teams: '50k+' },
  },
  {
    id: 'tools',
    name: 'Linear',
    category: 'tools',
    description: 'Issue tracking for high-velocity teams. Cycles, projects, roadmaps, Git sync. Fast, keyboard-first, opinionated.',
    price: { amount: 'Free', period: '', usd: '0' },
    features: [
      'Issues & projects',
      'Cycles & roadmaps',
      'GitHub/GitLab sync',
      'Custom workflows',
      'Insights & reports',
      'Command palette',
    ],
    cta: 'Start Free',
    href: 'https://linear.app',
    external: true,
    live: true,
    stats: { teams: '10k+', issues: '1M+', rating: '4.9★' },
  },
  {
    id: 'skills',
    name: 'Cursor',
    category: 'skills',
    description: 'AI-first code editor. Chat, edit, generate, autocomplete. Codebase-aware, multi-file edits, terminal integration.',
    price: { amount: '$20', period: '/month', usd: '$20' },
    features: [
      'Codebase-aware chat',
      'Multi-file edits',
      'Tab autocomplete',
      'Terminal AI (Cmd+K)',
      'Privacy mode',
      'GPT-4 / Claude',
    ],
    cta: 'Download Free',
    href: 'https://cursor.sh',
    external: true,
    live: true,
    stats: { devs: '500k+', languages: 'All', rating: '4.8★' },
  },
];

export function ProductMatrix() {
  return (
    <div className="space-y-8" id="matrix">
      <section className="space-y-4">
        <h2 className="text-3xl font-bold tracking-tight">Monetization Stack Landscape</h2>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Curated tools that help builders monetize, automate, and scale. Each solves a specific piece of the revenue puzzle.
        </p>
      </section>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card
            key={product.id}
            className={cn(
              'relative overflow-hidden transition-all hover:shadow-lg',
              product.live && 'ring-2 ring-green-500/30'
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-3xl mr-2">{categoryIcons[product.category] || '📦'}</span>
                  <CardTitle className="text-xl">{product.name}</CardTitle>
                </div>
                {product.live && (
                  <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Live
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{product.price.amount}</span>
                {product.price.period && <span className="text-muted-foreground">{product.price.period}</span>}
              </div>
              <ul className="space-y-2 text-sm">
                {product.features.slice(0, 4).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
                {product.features.length > 4 && (
                  <li className="text-xs text-muted-foreground">
                    +{product.features.length - 4} more features
                  </li>
                )}
              </ul>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {Object.entries(product.stats).map(([k, v]) => (
                    <span key={k} className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      {v} {k}
                    </span>
                  ))}
                </div>
                <Button
                  asChild
                  variant={product.external ? 'outline' : 'default'}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <a
                    href={product.href}
                    target={product.external ? '_blank' : undefined}
                    rel={product.external ? 'noopener noreferrer' : undefined}
                    className="flex items-center gap-1"
                  >
                    {product.cta}
                    {product.external && <ExternalLink className="h-3 w-3" />}
                    {!product.external && <ArrowUpRight className="h-3 w-3" />}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}