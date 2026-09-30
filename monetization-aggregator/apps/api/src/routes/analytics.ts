import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

const EventSchema = z.object({
  event: z.string().min(1).max(100),
  properties: z.record(z.unknown()).default({}),
  anonymousId: z.string().optional(),
});

const BatchEventsSchema = z.object({
  events: z.array(EventSchema).min(1).max(100),
});

export async function analyticsRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // POST /api/analytics/track - Track single event
  app.post('/track', { schema: { body: EventSchema } }, async (request, reply) => {
    const { event, properties, anonymousId } = request.body;

    await prisma.analyticsEvent.create({
      data: {
        userId: request.user?.id,
        anonymousId: anonymousId || request.headers['x-anonymous-id'] as string,
        event,
        properties,
        context: {
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          referrer: request.headers['referer'],
          utm: extractUtmParams(request.url),
        },
      },
    });

    return reply.send({ success: true, data: { tracked: true } });
  });

  // POST /api/analytics/track/batch - Track batch events
  app.post('/track/batch', { schema: { body: BatchEventsSchema } }, async (request, reply) => {
    const { events } = request.body;

    await prisma.analyticsEvent.createMany({
      data: events.map(e => ({
        userId: request.user?.id,
        anonymousId: e.anonymousId || request.headers['x-anonymous-id'] as string,
        event: e.event,
        properties: e.properties,
        context: {
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          referrer: request.headers['referer'],
          utm: extractUtmParams(request.url),
        },
      })),
    });

    return reply.send({ success: true, data: { tracked: events.length } });
  });

  // GET /api/analytics/dashboard - Dashboard metrics (admin/publisher)
  app.get('/dashboard', async (request, reply) => {
    const isAdmin = request.user?.role === 'ADMIN';
    const publisherId = isAdmin ? undefined : request.user.id;

    const [totalUsers, totalProducts, totalOrders, totalRevenue, recentOrders] = await Promise.all([
      prisma.user.count({ where: publisherId ? { referredById: publisherId } : undefined }),
      prisma.product.count({ where: { publisherId } }),
      prisma.order.count({ where: publisherId ? { product: { publisherId } } : undefined }),
      prisma.order.aggregate({
        where: { status: 'COMPLETED', ...(publisherId ? { product: { publisherId } } : {}) },
        _sum: { totalPriceAmount: true },
      }),
      prisma.order.findMany({
        where: publisherId ? { product: { publisherId } } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { product: { select: { name: true } }, user: { select: { email: true } } },
      }),
    ]);

    // Revenue by period
    const revenueByMonth = await prisma.$queryRaw`
      SELECT DATE_TRUNC('month', "createdAt") as month, SUM("totalPriceAmount") as revenue
      FROM "Order"
      WHERE status = 'COMPLETED' ${publisherId ? Prisma.sql`AND "productId" IN (SELECT id FROM "Product" WHERE "publisherId" = ${publisherId})` : Prisma.empty}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month DESC
      LIMIT 12
    `;

    return reply.send({
      success: true,
      data: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: Number(totalRevenue._sum.totalPriceAmount || 0),
        recentOrders,
        revenueByMonth,
      },
    });
  });

  // GET /api/analytics/events - Event analytics
  app.get('/events', { schema: { querystring: z.object({ event: z.string().optional(), days: z.number().int().positive().max(90).default(30), limit: z.number().int().positive().max(1000).default(100) }) } }, async (request, reply) => {
    const { event, days, limit } = request.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where: any = { timestamp: { gte: since } };
    if (event) where.event = event;
    if (!isAdmin) where.userId = request.user.id;

    const events = await prisma.analyticsEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    // Aggregate by event
    const eventCounts = await prisma.analyticsEvent.groupBy({
      by: ['event'],
      where,
      _count: { event: true },
      orderBy: { _count: { event: 'desc' } },
      take: 20,
    });

    return reply.send({
      success: true,
      data: { events, eventCounts },
    });
  });

  // GET /api/analytics/funnel - Conversion funnel
  app.get('/funnel', async (request, reply) => {
    const publisherId = request.user?.role === 'ADMIN' ? undefined : request.user.id;

    const [visitors, signups, firstPurchases, repeatPurchases] = await Promise.all([
      prisma.analyticsEvent.count({ where: { event: 'page_view', timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, ...(publisherId ? { referredById: publisherId } : {}) } }),
      prisma.order.count({ where: { status: 'COMPLETED', createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, ...(publisherId ? { product: { publisherId } } : {}) } }),
      prisma.order.groupBy({ by: ['userId'], where: { status: 'COMPLETED', createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, ...(publisherId ? { product: { publisherId } } : {}) }, _count: { userId: true }, having: { userId: { _count: { gt: 1 } } } }),
    ]);

    return reply.send({
      success: true,
      data: {
        visitors,
        signups,
        firstPurchases,
        repeatPurchases: repeatPurchases.length,
        conversionRates: {
          signup: visitors > 0 ? (signups / visitors * 100).toFixed(2) : 0,
          purchase: signups > 0 ? (firstPurchases / signups * 100).toFixed(2) : 0,
          repeat: firstPurchases > 0 ? (repeatPurchases.length / firstPurchases * 100).toFixed(2) : 0,
        },
      },
    });
  });
}

function extractUtmParams(url: string): Record<string, string> {
  try {
    const parsed = new URL(url, 'http://localhost');
    const utm: Record<string, string> = {};
    for (const [key, value] of parsed.searchParams.entries()) {
      if (key.startsWith('utm_')) utm[key] = value;
    }
    return utm;
  } catch {
    return {};
  }
}