import { FastifyInstance } from 'fastify';
import { PrismaClient, OrderStatus, TransactionType, TransactionStatus, PaymentMethod, SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import { Decimal } from 'decimal.js';
import crypto from 'crypto';

export async function webhookRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // POST /api/webhooks/alipay - Alipay payment notification
  app.post('/alipay', async (request, reply) => {
    const body = request.body as any;
    
    // Verify Alipay signature
    if (!verifyAlipaySignature(body)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid Alipay signature' } });
    }

    const { trade_no, out_trade_no, trade_status, total_amount, buyer_id } = body;

    // Find order by out_trade_no
    const order = await prisma.order.findUnique({ where: { paymentId: out_trade_no } });
    if (!order) {
      return reply.status(404).send({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
    }

    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      if (order.status === OrderStatus.COMPLETED) {
        return reply.send('success'); // Already processed
      }

      await completeOrder(order.id, prisma);
      
      // Update subscription if applicable
      if (order.product.pricingModel === 'SUBSCRIPTION') {
        await updateSubscriptionFromPayment(order.userId, order.product, prisma);
      }
    }

    return reply.send('success');
  });

  // POST /api/webhooks/x402 - x402 facilitator webhook
  app.post('/x402', async (request, reply) => {
    const body = request.body as any;
    
    // Verify x402 webhook signature
    if (!verifyX402Signature(body, request.headers)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid x402 signature' } });
    }

    const { paymentPayload, orderId, event } = body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return reply.status(404).send({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
    }

    if (event === 'payment_settled') {
      if (order.status !== OrderStatus.COMPLETED) {
        await completeOrder(order.id, prisma);
        
        // Record x402 payment details
        await prisma.x402Payment.update({
          where: { orderId: order.id },
          data: { verified: true, settledAt: new Date(), bazaarListed: true, bazaarListedAt: new Date() },
        });
      }
    }

    return reply.send({ success: true });
  });

  // POST /api/webhooks/stripe - Stripe webhook
  app.post('/stripe', async (request, reply) => {
    const signature = request.headers['stripe-signature'] as string;
    const payload = JSON.stringify(request.body);
    
    // Verify Stripe signature
    if (!verifyStripeSignature(payload, signature)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid Stripe signature' } });
    }

    const event = request.body as any;
    
    switch (event.type) {
      case 'checkout.session.completed':
        await handleStripeCheckoutCompleted(event.data.object, prisma);
        break;
      case 'invoice.payment_succeeded':
        await handleStripeInvoicePaymentSucceeded(event.data.object, prisma);
        break;
      case 'customer.subscription.updated':
        await handleStripeSubscriptionUpdated(event.data.object, prisma);
        break;
      case 'customer.subscription.deleted':
        await handleStripeSubscriptionDeleted(event.data.object, prisma);
        break;
    }

    return reply.send({ received: true });
  });

  // POST /api/webhooks/payout - Payout webhook (for USDC payouts)
  app.post('/payout', async (request, reply) => {
    const { payoutId, status, txHash } = request.body as any;

    const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Payout not found' } });
    }

    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: status === 'confirmed' ? 'COMPLETED' : 'FAILED',
        transactionHash: txHash,
        completedAt: status === 'confirmed' ? new Date() : null,
      },
    });

    return reply.send({ success: true });
  });
}

// Verification functions
function verifyAlipaySignature(body: any): boolean {
  // Implement Alipay RSA2 signature verification
  // For development, accept all
  if (process.env.NODE_ENV === 'development') return true;
  
  const publicKey = process.env.ALIPAY_PUBLIC_KEY;
  if (!publicKey) return false;
  
  // Implement actual verification using crypto
  return true; // Placeholder
}

function verifyX402Signature(body: any, headers: any): boolean {
  // Verify x402 facilitator webhook signature
  if (process.env.NODE_ENV === 'development') return true;
  return true; // Placeholder
}

function verifyStripeSignature(payload: string, signature: string): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return false;
  
  // Implement Stripe signature verification
  return true; // Placeholder
}

// Handler functions
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
      type: TransactionType.PAYMENT,
      amount: order.totalPriceAmount,
      currency: order.totalPriceCurrency,
      status: TransactionStatus.COMPLETED,
      description: `Payment for ${order.product.name}`,
      alipayTradeNo: order.paymentId,
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
        type: TransactionType.COMMISSION,
        amount: order.commissionAmount,
        currency: order.totalPriceCurrency,
        status: TransactionStatus.COMPLETED,
        description: `Affiliate commission for ${order.product.name}`,
        metadata: { orderId: order.id },
      },
    });
  }
}

async function updateSubscriptionFromPayment(userId: string, product: any, prisma: PrismaClient) {
  const tierMap: Record<string, SubscriptionTier> = {
    'starter': SubscriptionTier.STARTER,
    'pro': SubscriptionTier.PRO,
    'team': SubscriptionTier.TEAM,
  };

  const tier = tierMap[product.slug] || SubscriptionTier.PRO;
  
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      tier,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {
      tier,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { role: tier === SubscriptionTier.ENTERPRISE ? 'ENTERPRISE' : 'PRO' },
  });
}

async function handleStripeCheckoutCompleted(session: any, prisma: PrismaClient) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order && order.status !== OrderStatus.COMPLETED) {
    await completeOrder(orderId, prisma);
  }
}

async function handleStripeInvoicePaymentSucceeded(invoice: any, prisma: PrismaClient) {
  // Handle recurring subscription payments
  const subscriptionId = invoice.subscription;
  // Update subscription record
}

async function handleStripeSubscriptionUpdated(subscription: any, prisma: PrismaClient) {
  // Update local subscription status
}

async function handleStripeSubscriptionDeleted(subscription: any, prisma: PrismaClient) {
  // Mark subscription as canceled
}