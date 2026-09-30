import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient, ReferralStatus, ReferralTier } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { getReferralTier, getTierConfig, DEFAULT_REFERRAL_TIERS } from '@monetization/shared';

const ReferralQuerySchema = z.object({
  status: z.nativeEnum(ReferralStatus).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export async function referralRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // GET /api/referrals - Get user's referrals
  app.get('/', { schema: { querystring: ReferralQuerySchema } }, async (request, reply) => {
    const { status, page, pageSize } = request.query as z.infer<typeof ReferralQuerySchema>;

    const where: any = { referrerId: request.user.id };
    if (status) where.status = status;

    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        orderBy: { clickedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          referred: { select: { id: true, email: true, name: true, avatar: true, createdAt: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.referral.count({ where }),
    ]);

    // Get tier info
    const totalReferrals = await prisma.referral.count({ where: { referrerId: request.user.id } });
    const currentTier = getReferralTier(totalReferrals);
    const tierConfig = getTierConfig(currentTier);
    const nextTier = getNextTier(currentTier);
    const nextTierConfig = nextTier ? getTierConfig(nextTier) : null;

    return reply.send({
      success: true,
      data: {
        referrals: referrals.map(r => ({
          ...r,
          commissionAmount: Number(r.commissionAmount),
        })),
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        tier: {
          current: currentTier,
          config: tierConfig,
          next: nextTier,
          nextConfig: nextTierConfig,
          progress: nextTierConfig ? totalReferrals / nextTierConfig.minReferrals : 1,
          totalReferrals,
        },
        allTiers: DEFAULT_REFERRAL_TIERS,
      },
    });
  });

  // GET /api/referrals/stats - Referral statistics
  app.get('/stats', async (request, reply) => {
    const [totalReferrals, confirmedReferrals, paidReferrals, totalEarnings] = await Promise.all([
      prisma.referral.count({ where: { referrerId: request.user.id } }),
      prisma.referral.count({ where: { referrerId: request.user.id, status: ReferralStatus.CONFIRMED } }),
      prisma.referral.count({ where: { referrerId: request.user.id, status: ReferralStatus.PAID } }),
      prisma.referral.aggregate({
        where: { referrerId: request.user.id, status: { in: [ReferralStatus.CONFIRMED, ReferralStatus.PAID] } },
        _sum: { commissionAmount: true },
      }),
    ]);

    // Earnings by currency
    const earningsByCurrency = await prisma.referral.groupBy({
      by: ['commissionCurrency'],
      where: { referrerId: request.user.id, status: { in: [ReferralStatus.CONFIRMED, ReferralStatus.PAID] } },
      _sum: { commissionAmount: true },
    });

    return reply.send({
      success: true,
      data: {
        totalReferrals,
        confirmedReferrals,
        paidReferrals,
        totalEarnings: Number(totalEarnings._sum.commissionAmount || 0),
        earningsByCurrency: earningsByCurrency.map(e => ({
          currency: e.commissionCurrency,
          amount: Number(e._sum.commissionAmount || 0),
        })),
      },
    });
  });

  // GET /api/referrals/link - Get referral link
  app.get('/link', async (request, reply) => {
    const baseUrl = process.env.FRONTEND_URL || 'https://app.highkingflower.com';
    const referralLink = `${baseUrl}/?ref=${request.user.referralCode}`;

    return reply.send({
      success: true,
      data: {
        referralCode: request.user.referralCode,
        referralLink,
        qrCode: `${baseUrl}/api/qr?data=${encodeURIComponent(referralLink)}`,
        shareText: `Join me on BoostAI and earn rewards! ${referralLink}`,
      },
    });
  });

  // POST /api/referrals/track-click - Track referral click (public endpoint)
  app.post('/track-click', { schema: { body: z.object({ code: z.string().length(8) }) } }, async (request, reply) => {
    const { code } = request.body;
    
    const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!referrer) {
      return reply.status(404).send({ success: false, error: { code: 'INVALID_CODE', message: 'Invalid referral code' } });
    }

    // Record click (anonymous until conversion)
    return reply.send({
      success: true,
      data: { referrerId: referrer.id, referrerName: referrer.name },
    });
  });
}

function getNextTier(current: ReferralTier): ReferralTier | null {
  const order: ReferralTier[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
  const index = order.indexOf(current);
  return index < order.length - 1 ? order[index + 1] : null;
}