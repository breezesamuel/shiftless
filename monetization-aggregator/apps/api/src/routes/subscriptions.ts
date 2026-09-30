import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient, SubscriptionTier, SubscriptionStatus, PaymentMethod } from '@prisma/client';
import { Decimal } from 'decimal.js';

const CreateSubscriptionSchema = z.object({
  tier: z.nativeEnum(SubscriptionTier),
  paymentMethod: z.enum([PaymentMethod.ALIPAY, PaymentMethod.STRIPE]),
  paymentId: z.string().optional(),
  trialDays: z.number().int().nonnegative().optional(),
});

const SubscriptionQuerySchema = z.object({
  status: z.nativeEnum(SubscriptionStatus).optional(),
  tier: z.nativeEnum(SubscriptionTier).optional(),
});

const TIER_PRICES: Record<SubscriptionTier, { amount: number; currency: string; interval: string }> = {
  FREE: { amount: 0, currency: 'CNY', interval: 'month' },
  STARTER: { amount: 10, currency: 'CNY', interval: 'month' },      // ¥10/mo
  PRO: { amount: 99, currency: 'CNY', interval: 'month' },         // ¥99/mo
  TEAM: { amount: 299, currency: 'CNY', interval: 'month' },       // ¥299/mo
  ENTERPRISE: { amount: 0, currency: 'CNY', interval: 'month' },   // Custom
};

export async function subscriptionRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // GET /api/subscriptions - Get current subscription
  app.get('/', async (request, reply) => {
    const subscription = await prisma.subscription.findUnique({ where: { userId: request.user.id } });
    
    if (!subscription) {
      return reply.send({ success: true, data: { tier: 'FREE', status: 'ACTIVE', features: getTierFeatures('FREE') } });
    }

    return reply.send({
      success: true,
      data: {
        ...subscription,
        features: getTierFeatures(subscription.tier),
        price: TIER_PRICES[subscription.tier],
      },
    });
  });

  // POST /api/subscriptions - Create/upgrade subscription
  app.post('/', { schema: { body: CreateSubscriptionSchema } }, async (request, reply) => {
    const { tier, paymentMethod, paymentId, trialDays } = request.body;

    if (tier === SubscriptionTier.FREE) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_TIER', message: 'Cannot subscribe to FREE tier' } });
    }

    const price = TIER_PRICES[tier];
    const existing = await prisma.subscription.findUnique({ where: { userId: request.user.id } });

    const now = new Date();
    const periodEnd = trialDays
      ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    if (existing) {
      // Upgrade/downgrade
      const updated = await prisma.subscription.update({
        where: { userId: request.user.id },
        data: {
          tier,
          status: trialDays ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          trialEnd: trialDays ? periodEnd : null,
          alipaySubscriptionId: paymentMethod === PaymentMethod.ALIPAY ? paymentId : existing.alipaySubscriptionId,
        },
      });
      return reply.send({ success: true, data: updated });
    }

    const subscription = await prisma.subscription.create({
      data: {
        userId: request.user.id,
        tier,
        status: trialDays ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEnd: trialDays ? periodEnd : null,
        alipaySubscriptionId: paymentMethod === PaymentMethod.ALIPAY ? paymentId : null,
      },
    });

    // Update user role based on tier
    await prisma.user.update({
      where: { id: request.user.id },
      data: { role: tier === SubscriptionTier.ENTERPRISE ? 'ENTERPRISE' : 'PRO' },
    });

    return reply.status(201).send({ success: true, data: subscription });
  });

  // PATCH /api/subscriptions/cancel - Cancel subscription
  app.patch('/cancel', async (request, reply) => {
    const subscription = await prisma.subscription.findUnique({ where: { userId: request.user.id } });
    if (!subscription) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No active subscription' } });
    }

    await prisma.subscription.update({
      where: { userId: request.user.id },
      data: { cancelAtPeriodEnd: true, status: SubscriptionStatus.CANCELED },
    });

    return reply.send({ success: true, data: { message: 'Subscription will be canceled at period end' } });
  });

  // POST /api/subscriptions/resume - Resume canceled subscription
  app.post('/resume', async (request, reply) => {
    const subscription = await prisma.subscription.findUnique({ where: { userId: request.user.id } });
    if (!subscription || subscription.status !== SubscriptionStatus.CANCELED) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_STATE', message: 'Subscription not canceled' } });
    }

    await prisma.subscription.update({
      where: { userId: request.user.id },
      data: { cancelAtPeriodEnd: false, status: SubscriptionStatus.ACTIVE },
    });

    return reply.send({ success: true, data: { message: 'Subscription resumed' } });
  });

  // GET /api/subscriptions/tiers - Get all tier details
  app.get('/tiers', async (request, reply) => {
    return reply.send({
      success: true,
      data: Object.entries(TIER_PRICES).map(([tier, price]) => ({
        tier,
        price,
        features: getTierFeatures(tier as SubscriptionTier),
      })),
    });
  });
}

function getTierFeatures(tier: SubscriptionTier): string[] {
  const features: Record<SubscriptionTier, string[]> = {
    FREE: [
      '10 free tool uses per day',
      'Basic API access (100 calls/month)',
      'Community support',
    ],
    STARTER: [
      'Unlimited tool usage',
      '1,000 API calls/month',
      'Email support',
      'Basic analytics',
    ],
    PRO: [
      'Unlimited tool usage',
      '10,000 API calls/month',
      'Priority email support',
      'Advanced analytics',
      'x402 API access',
      'Custom integrations',
    ],
    TEAM: [
      'Everything in Pro',
      '100,000 API calls/month',
      'Team collaboration (5 seats)',
      'Dedicated support',
      'SSO authentication',
      'Audit logs',
    ],
    ENTERPRISE: [
      'Everything in Team',
      'Unlimited API calls',
      'Unlimited seats',
      '24/7 dedicated support',
      'Custom SLA',
      'On-premise deployment option',
      'Custom feature development',
    ],
  };
  return features[tier] || features.FREE;
}