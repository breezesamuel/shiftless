import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient, OrderStatus, PaymentMethod, ProductStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';

const CreateOrderSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  paymentMethod: z.nativeEnum(PaymentMethod),
  paymentId: z.string().optional(),
  referralCode: z.string().length(8).optional(),
});

const OrderQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  productId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export async function orderRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // GET /api/orders - List user's orders
  app.get('/', { schema: { querystring: OrderQuerySchema } }, async (request, reply) => {
    const { status, productId, startDate, endDate, page, pageSize } = request.query as z.infer<typeof OrderQuerySchema>;

    const where: any = { userId: request.user.id };
    if (status) where.status = status;
    if (productId) where.productId = productId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { product: { select: { id: true, name: true, slug: true, images: true } } },
      }),
      prisma.order.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: orders.map(o => ({
        ...o,
        unitPriceAmount: Number(o.unitPriceAmount),
        totalPriceAmount: Number(o.totalPriceAmount),
        commissionAmount: Number(o.commissionAmount),
      })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  });

  // GET /api/orders/:id - Get order details
  app.get<{ Params: { id: string } }>(
    '/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const order = await prisma.order.findUnique({
        where: { id: request.params.id },
        include: { product: true, user: { select: { id: true, email: true, name: true } } },
      });

      if (!order || order.userId !== request.user.id) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      }

      return reply.send({
        success: true,
        data: {
          ...order,
          unitPriceAmount: Number(order.unitPriceAmount),
          totalPriceAmount: Number(order.totalPriceAmount),
          commissionAmount: Number(order.commissionAmount),
        },
      });
    }
  );

  // POST /api/orders - Create order (Alipay, Stripe, Balance, Free)
  app.post('/', { schema: { body: CreateOrderSchema } }, async (request, reply) => {
    const { productId, quantity, paymentMethod, paymentId, referralCode } = request.body;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { publisher: { select: { id: true, walletAddress: true } } },
    });

    if (!product || product.status !== ProductStatus.ACTIVE) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not available' } });
    }

    // Check if user already has access (for digital products)
    if (product.pricingModel !== 'PAY_PER_USE') {
      const existingOrder = await prisma.order.findFirst({
        where: { userId: request.user.id, productId, status: OrderStatus.COMPLETED },
      });
      if (existingOrder) {
        return reply.status(409).send({ success: false, error: { code: 'ALREADY_OWNED', message: 'You already own this product' } });
      }
    }

    // Handle referral
    let affiliateId: string | null = null;
    let commissionAmount = new Decimal(0);
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
      if (referrer && referrer.id !== request.user.id) {
        affiliateId = referrer.id;
        const tierConfig = getReferralTierConfig(referrer);
        commissionAmount = calculateCommission(Number(product.priceAmount) * quantity, tierConfig.commissionRate);
      }
    }

    const totalPrice = new Decimal(product.priceAmount).mul(quantity);
    
    const order = await prisma.order.create({
      data: {
        userId: request.user.id,
        productId,
        quantity,
        unitPriceAmount: product.priceAmount,
        unitPriceCurrency: product.priceCurrency,
        totalPriceAmount: totalPrice,
        totalPriceCurrency: product.priceCurrency,
        status: paymentMethod === PaymentMethod.FREE ? OrderStatus.COMPLETED : OrderStatus.PENDING,
        paymentMethod,
        paymentId,
        affiliateId,
        commissionAmount,
        completedAt: paymentMethod === PaymentMethod.FREE ? new Date() : null,
      },
    });

    if (paymentMethod === PaymentMethod.FREE) {
      await completeOrder(order.id, prisma);
    }

    return reply.status(201).send({
      success: true,
      data: { ...order, unitPriceAmount: Number(order.unitPriceAmount), totalPriceAmount: Number(order.totalPriceAmount) },
    });
  });

  // POST /api/orders/:id/cancel - Cancel pending order
  app.post<{ Params: { id: string } }>(
    '/:id/cancel',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const order = await prisma.order.findUnique({ where: { id: request.params.id } });
      if (!order || order.userId !== request.user.id) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      }

      if (order.status !== OrderStatus.PENDING) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_STATE', message: 'Order cannot be cancelled' } });
      }

      await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELED } });
      return reply.send({ success: true, data: { message: 'Order cancelled' } });
    }
  );

  // GET /api/orders/stats/summary - Order statistics
  app.get('/stats/summary', async (request, reply) => {
    const [totalOrders, completedOrders, totalSpent, pendingOrders] = await Promise.all([
      prisma.order.count({ where: { userId: request.user.id } }),
      prisma.order.count({ where: { userId: request.user.id, status: OrderStatus.COMPLETED } }),
      prisma.order.aggregate({ where: { userId: request.user.id, status: OrderStatus.COMPLETED }, _sum: { totalPriceAmount: true } }),
      prisma.order.count({ where: { userId: request.user.id, status: OrderStatus.PENDING } }),
    ]);

    return reply.send({
      success: true,
      data: {
        totalOrders,
        completedOrders,
        pendingOrders,
        totalSpent: Number(totalSpent._sum.totalPriceAmount || 0),
      },
    });
  });
}

// Helper functions
function getReferralTierConfig(user: any) {
  const count = user.referralsMade?.length || 0;
  if (count >= 500) return { commissionRate: 0.50 };
  if (count >= 100) return { commissionRate: 0.30 };
  if (count >= 20) return { commissionRate: 0.20 };
  if (count >= 5) return { commissionRate: 0.15 };
  return { commissionRate: 0.10 };
}

function calculateCommission(amount: number, rate: number): Decimal {
  return new Decimal(amount).mul(rate).toDP(2, Decimal.ROUND_DOWN);
}

async function completeOrder(orderId: string, prisma: PrismaClient) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.COMPLETED, completedAt: new Date() },
    include: { product: true, user: true },
  });

  await prisma.transaction.create({
    data: {
      orderId: order.id,
      userId: order.userId,
      type: 'PAYMENT',
      amount: order.totalPriceAmount,
      currency: order.totalPriceCurrency,
      status: 'COMPLETED',
      description: `Payment for ${order.product.name}`,
    },
  });

  await prisma.product.update({
    where: { id: order.productId },
    data: { salesCount: { increment: 1 }, revenue: { increment: order.totalPriceAmount } },
  });

  if (order.affiliateId && order.commissionAmount.gt(0)) {
    await prisma.referral.create({
      data: {
        referrerId: order.affiliateId,
        referredId: order.userId,
        productId: order.productId,
        commissionAmount: order.commissionAmount,
        commissionCurrency: order.totalPriceCurrency,
        status: 'CONFIRMED',
        tierAtReferral: 'BRONZE',
        convertedAt: new Date(),
      },
    });

    await prisma.transaction.create({
      data: {
        userId: order.affiliateId,
        type: 'COMMISSION',
        amount: order.commissionAmount,
        currency: order.totalPriceCurrency,
        status: 'COMPLETED',
        description: `Affiliate commission for ${order.product.name}`,
        metadata: { orderId: order.id },
      },
    });
  }
}