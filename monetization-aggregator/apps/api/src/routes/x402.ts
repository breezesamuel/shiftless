import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { PrismaClient, PaymentMethod, OrderStatus, TransactionType, TransactionStatus, ProductStatus } from '@prisma/client';
import { PaymentRequiredSchema, X402Network, BazaarExtensionSchema, getTierConfig, calculateCommission, generateReferralCode } from '@monetization/shared';

// x402 Payment Schemas
const CreatePaymentRequestSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  paymentMethod: z.enum(['x402']),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  referralCode: z.string().length(8).optional(),
});

const VerifyPaymentSchema = z.object({
  paymentPayload: z.string(),
  orderId: z.string().uuid(),
});

const PaymentRequiredResponseSchema = z.object({
  x402Version: z.literal(2),
  resource: z.object({
    url: z.string().url(),
    description: z.string(),
    mimeType: z.string(),
  }),
  accepts: z.array(z.object({
    scheme: z.literal('exact'),
    network: z.string(),
    asset: z.string(),
    amount: z.string(),
    payTo: z.string(),
    maxTimeoutSeconds: z.number(),
    extra: z.record(z.unknown()).optional(),
  })),
  extensions: z.object({
    bazaar: BazaarExtensionSchema,
  }).optional(),
});

type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
type VerifyPaymentRequest = z.infer<typeof VerifyPaymentSchema>;

// Bazaar Discovery Extension
function buildBazaarExtension(product: any): any {
  return {
    input: {
      type: 'http',
      queryParams: {
        productId: product.id,
        action: 'purchase',
      },
    },
    output: {
      type: 'json',
      example: {
        success: true,
        orderId: 'uuid',
        accessToken: 'jwt-token',
        product: {
          id: product.id,
          name: product.name,
          category: product.category,
        },
      },
    },
  };
}

// Build PaymentRequired response per x402 spec
function buildPaymentRequired(product: any, requestUrl: string): any {
  const requirements = [{
    scheme: 'exact',
    network: product.x402Network || 'eip155:8453',
    asset: product.x402Asset || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base mainnet USDC
    amount: new Decimal(product.x402PricePerCall || '0.10').mul(1_000_000).toFixed(0), // 6 decimals for USDC
    payTo: product.x402PayTo || process.env.X402_PAY_TO || '0x12A2b19eFA9D8BC48ac156Cc8FdfC7cC0Dff36aB',
    maxTimeoutSeconds: 300,
    extra: {
      name: 'USDC',
      version: '2',
      productId: product.id,
      productName: product.name,
    },
  }];

  const response: any = {
    x402Version: 2,
    resource: {
      url: requestUrl,
      description: product.shortDescription || product.name,
      mimeType: 'application/json',
    },
    accepts: requirements,
  };

  // Add Bazaar extension for auto-discovery
  if (product.x402Enabled) {
    response.extensions = {
      bazaar: buildBazaarExtension(product),
    };
  }

  return response;
}

export async function x402Routes(app: FastifyInstance) {
  const prisma = app.prisma;

  // GET /api/x402/pay/:productId - Returns 402 PaymentRequired with Bazaar extension
  app.get<{ Params: { productId: string } }>(
    '/pay/:productId',
    {
      schema: {
        params: z.object({ productId: z.string().uuid() }),
        response: {
          402: PaymentRequiredResponseSchema,
          200: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }),
        },
      },
    },
    async (request: FastifyRequest<{ Params: { productId: string } }>, reply: FastifyReply) => {
      const { productId } = request.params;
      
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { publisher: { select: { id: true, name: true, walletAddress: true } } },
      });

      if (!product || product.status !== ProductStatus.ACTIVE) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
      }

      if (!product.x402Enabled) {
        return reply.status(400).send({ success: false, error: { code: 'X402_DISABLED', message: 'x402 payments not enabled for this product' } });
      }

      // Check if user already has access (subscription, previous purchase)
      if (request.user) {
        const hasAccess = await checkUserAccess(request.user.id, productId, prisma);
        if (hasAccess) {
          return reply.status(200).send({ success: true, data: { message: 'Access granted' } });
        }
      }

      // Return 402 PaymentRequired with Bazaar extension
      const paymentRequired = buildPaymentRequired(product, request.url);
      
      return reply
        .status(402)
        .header('x402-payment-required', 'true')
        .header('x402-scheme', 'exact')
        .header('x402-network', product.x402Network || 'eip155:8453')
        .header('x402-price', product.x402PricePerCall || '0.10 USD')
        .header('Cache-Control', 'no-store')
        .send(paymentRequired);
    }
  );

  // POST /api/x402/verify - Verify x402 payment payload
  app.post<{ Body: VerifyPaymentRequest }>(
    '/verify',
    {
      schema: {
        body: VerifyPaymentSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.object({
              orderId: z.string(),
              accessToken: z.string(),
              product: z.object({ id: z.string(), name: z.string() }),
            }),
          }),
        },
      },
    },
    async (request: FastifyRequest<{ Body: VerifyPaymentRequest }>, reply: FastifyReply) => {
      const { paymentPayload, orderId } = request.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { product: true, user: true },
      });

      if (!order) {
        return reply.status(404).send({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
      }

      if (order.status !== OrderStatus.PENDING) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_ORDER_STATE', message: 'Order already processed' } });
      }

      // Verify payment with facilitator
      const verified = await verifyX402Payment(paymentPayload, order);
      
      if (!verified) {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.FAILED },
        });
        return reply.status(402).send({ success: false, error: { code: 'PAYMENT_FAILED', message: 'Payment verification failed' } });
      }

      // Complete order
      await completeOrder(orderId, paymentPayload, prisma);

      // Generate access token
      const accessToken = app.jwt.sign({
        sub: order.userId,
        productId: order.productId,
        orderId: order.id,
        type: 'product_access',
      }, { expiresIn: '1y' });

      return reply.send({
        success: true,
        data: {
          orderId: order.id,
          accessToken,
          product: { id: order.product.id, name: order.product.name },
        },
      });
    }
  );

  // POST /api/x402/create-order - Create pending order for x402 payment
  app.post<{ Body: CreatePaymentRequest }>(
    '/create-order',
    {
      schema: {
        body: CreatePaymentRequestSchema,
        response: {
          201: z.object({
            success: z.boolean(),
            data: z.object({
              orderId: z.string(),
              paymentRequired: PaymentRequiredResponseSchema,
            }),
          }),
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreatePaymentRequest }>, reply: FastifyReply) => {
      const { productId, quantity, paymentMethod, walletAddress, referralCode } = request.body;

      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { publisher: { select: { id: true, name: true, walletAddress: true } } },
      });

      if (!product || product.status !== ProductStatus.ACTIVE || !product.x402Enabled) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not available for x402' } });
      }

      // Get or create user by wallet
      let user = await prisma.user.findUnique({ where: { walletAddress } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: `${walletAddress.slice(0, 10)}@web3.user`,
            walletAddress,
            role: 'FREE',
            referralCode: generateReferralCode(),
          },
        });
      }

      // Handle referral
      let affiliateId: string | null = null;
      let commissionAmount = new Decimal(0);
      if (referralCode) {
        const referrer = await prisma.user.findUnique({ where: { referralCode } });
        if (referrer && referrer.id !== user.id) {
          affiliateId = referrer.id;
          const tierConfig = getTierConfig(referrer.referrals.length > 500 ? 'diamond' : 
            referrer.referrals.length > 100 ? 'platinum' :
            referrer.referrals.length > 20 ? 'gold' :
            referrer.referrals.length > 5 ? 'silver' : 'bronze');
          commissionAmount = calculateCommission(Number(product.priceAmount), tierConfig.commissionRate);
        }
      }

      // Create pending order
      const totalPrice = new Decimal(product.priceAmount).mul(quantity);
      const order = await prisma.order.create({
        data: {
          userId: user.id,
          productId: product.id,
          quantity,
          unitPriceAmount: product.priceAmount,
          unitPriceCurrency: product.priceCurrency,
          totalPriceAmount: totalPrice,
          totalPriceCurrency: product.priceCurrency,
          status: OrderStatus.PENDING,
          paymentMethod: PaymentMethod.X402,
          affiliateId,
          commissionAmount,
        },
      });

      // Build payment required response
      const paymentRequired = buildPaymentRequired(product, `${process.env.API_URL}/api/x402/pay/${productId}`);

      return reply.status(201).send({
        success: true,
        data: { orderId: order.id, paymentRequired },
      });
    }
  );

  // GET /api/x402/config - Get x402 configuration for frontend
  app.get('/config', async (request, reply) => {
    return reply.send({
      success: true,
      data: {
        network: process.env.X402_NETWORK || 'eip155:8453',
        facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://facilitator.goplausible.xyz',
        payTo: process.env.X402_PAY_TO || '0x12A2b19eFA9D8BC48ac156Cc8FdfC7cC0Dff36aB',
        defaultPrice: process.env.X402_DEFAULT_PRICE || '0.10 USD',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base mainnet USDC
        bazaarEnabled: true,
      },
    });
  });

  // GET /api/x402/products - List x402-enabled products
  app.get('/products', async (request, reply) => {
    const products = await prisma.product.findMany({
      where: { x402Enabled: true, status: ProductStatus.ACTIVE },
      select: {
        id: true,
        slug: true,
        name: true,
        shortDescription: true,
        category: true,
        priceAmount: true,
        priceCurrency: true,
        x402PricePerCall: true,
        x402Network: true,
        rating: true,
        salesCount: true,
        publisherName: true,
        publisherVerified: true,
      },
      orderBy: { salesCount: 'desc' },
    });

    return reply.send({
      success: true,
      data: products.map(p => ({
        ...p,
        priceAmount: Number(p.priceAmount),
        x402PricePerCall: p.x402PricePerCall || '0.10 USD',
      })),
    });
  });
}

// Helper: Check if user has access to product
async function checkUserAccess(userId: string, productId: string, prisma: PrismaClient): Promise<boolean> {
  // Check active subscription
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (subscription && subscription.status === 'ACTIVE' && subscription.tier !== 'FREE') {
    return true;
  }

  // Check completed order
  const order = await prisma.order.findFirst({
    where: { userId, productId, status: OrderStatus.COMPLETED },
  });
  if (order) return true;

  return false;
}

// Helper: Verify x402 payment with facilitator
async function verifyX402Payment(paymentPayload: string, order: any): Promise<boolean> {
  try {
    const facilitatorUrl = order.product.x402FacilitatorUrl || process.env.X402_FACILITATOR_URL || 'https://facilitator.goplausible.xyz';
    
    // In production, use x402 SDK to verify
    // For now, we'll simulate verification
    const response = await fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload,
        requirements: {
          scheme: 'exact',
          network: order.product.x402Network || 'eip155:8453',
          asset: order.product.x402Asset || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amount: new Decimal(order.product.x402PricePerCall || '0.10').mul(1_000_000).toFixed(0),
          payTo: order.product.x402PayTo || process.env.X402_PAY_TO,
        },
      }),
    });

    const result = await response.json();
    return result.valid === true;
  } catch (error) {
    console.error('x402 verification error:', error);
    // In development, allow test payments
    if (process.env.NODE_ENV === 'development') {
      return paymentPayload.includes('test') || paymentPayload.length > 100;
    }
    return false;
  }
}

// Helper: Complete order after verified payment
async function completeOrder(orderId: string, paymentPayload: string, prisma: PrismaClient) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.COMPLETED,
      x402PaymentPayload: paymentPayload,
      completedAt: new Date(),
    },
    include: { product: true, user: true },
  });

  // Create transaction record
  await prisma.transaction.create({
    data: {
      orderId: order.id,
      userId: order.userId,
      type: TransactionType.PAYMENT,
      amount: order.totalPriceAmount,
      currency: order.totalPriceCurrency,
      status: TransactionStatus.COMPLETED,
      description: `x402 payment for ${order.product.name}`,
      blockchainTxHash: `0x${paymentPayload.slice(-64)}`, // Extract tx hash from payload
    },
  });

  // Update product stats
  await prisma.product.update({
    where: { id: order.productId },
    data: {
      salesCount: { increment: 1 },
      revenue: { increment: order.totalPriceAmount },
    },
  });

  // Handle affiliate commission
  if (order.affiliateId && order.commissionAmount.gt(0)) {
    await prisma.referral.create({
      data: {
        referrerId: order.affiliateId,
        referredId: order.userId,
        productId: order.productId,
        commissionAmount: order.commissionAmount,
        commissionCurrency: order.totalPriceCurrency,
        status: 'CONFIRMED',
        tierAtReferral: 'BRONZE', // Will be updated by referral service
        convertedAt: new Date(),
      },
    });

    // Create commission transaction
    await prisma.transaction.create({
      data: {
        userId: order.affiliateId,
        type: TransactionType.COMMISSION,
        amount: order.commissionAmount,
        currency: order.totalPriceCurrency,
        status: TransactionStatus.COMPLETED,
        description: `Affiliate commission for ${order.product.name} sale`,
        metadata: { orderId: order.id, productId: order.productId },
      },
    });
  }

  // Record x402 payment details
  await prisma.x402Payment.create({
    data: {
      orderId: order.id,
      paymentPayload,
      paymentRequirements: {
        scheme: 'exact',
        network: order.product.x402Network || 'eip155:8453',
        asset: order.product.x402Asset || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amount: new Decimal(order.product.x402PricePerCall || '0.10').mul(1_000_000).toFixed(0),
        payTo: order.product.x402PayTo || process.env.X402_PAY_TO,
      },
      network: order.product.x402Network || 'eip155:8453',
      asset: order.product.x402Asset || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      amount: new Decimal(order.product.x402PricePerCall || '0.10').mul(1_000_000).toFixed(0),
      payTo: order.product.x402PayTo || process.env.X402_PAY_TO,
      facilitatorUrl: order.product.x402FacilitatorUrl || process.env.X402_FACILITATOR_URL,
      verified: true,
      settledAt: new Date(),
    },
  });
}