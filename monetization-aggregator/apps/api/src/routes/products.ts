import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient, ProductStatus, ProductCategory, PricingModel } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { ProductSchema, PriceSchema, ProductCategory as SharedProductCategory, PricingModel as SharedPricingModel } from '@monetization/shared';

const CreateProductSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().max(200),
  description: z.string().max(5000),
  shortDescription: z.string().max(300),
  category: z.nativeEnum(SharedProductCategory),
  pricingModel: z.nativeEnum(SharedPricingModel),
  price: PriceSchema,
  originalPrice: PriceSchema.optional(),
  images: z.array(z.string().url()).max(10).default([]),
  features: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  commissionRate: z.number().min(0).max(1).default(0.15),
  affiliateCommission: z.number().min(0).max(1).default(0.10),
  x402Enabled: z.boolean().default(false),
  x402Config: z.object({
    network: z.string().default('eip155:8453'),
    facilitatorUrl: z.string().url().default('https://facilitator.goplausible.xyz'),
    pricePerCall: z.string().default('0.10 USD'),
    payTo: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    resourceUrl: z.string().url(),
  }).optional(),
  metadata: z.record(z.unknown()).default({}),
});

const UpdateProductSchema = CreateProductSchema.partial();

const ProductQuerySchema = z.object({
  category: z.nativeEnum(SharedProductCategory).optional(),
  pricingModel: z.nativeEnum(SharedPricingModel).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  publisherId: z.string().uuid().optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  sortBy: z.enum(['createdAt', 'salesCount', 'rating', 'price', 'revenue']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export async function productRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // GET /api/products - List products with filters
  app.get('/', { schema: { querystring: ProductQuerySchema } }, async (request, reply) => {
    const {
      category, pricingModel, status, publisherId, search, tags,
      minPrice, maxPrice, sortBy, sortOrder, page, pageSize,
    } = request.query as z.infer<typeof ProductQuerySchema>;

    const where: any = {};

    if (category) where.category = category;
    if (pricingModel) where.pricingModel = pricingModel;
    if (status) where.status = status;
    if (publisherId) where.publisherId = publisherId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ];
    }
    if (tags?.length) where.tags = { hasEvery: tags };
    if (minPrice || maxPrice) {
      where.priceAmount = {};
      if (minPrice) where.priceAmount.gte = minPrice;
      if (maxPrice) where.priceAmount.lte = maxPrice;
    }

    // Non-admin users only see active products
    const isAdmin = request.user?.role === 'ADMIN';
    if (!isAdmin) where.status = ProductStatus.ACTIVE;
    if (!isAdmin && publisherId) where.publisherId = request.user.id; // Own products only

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          publisher: { select: { id: true, name: true, avatar: true, verified: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: products.map(p => ({
        ...p,
        priceAmount: Number(p.priceAmount),
        originalPriceAmount: p.originalPriceAmount ? Number(p.originalPriceAmount) : undefined,
        revenue: Number(p.revenue),
      })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  });

  // GET /api/products/:id - Get product details
  app.get<{ Params: { id: string } }>(
    '/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const product = await prisma.product.findUnique({
        where: { id: request.params.id },
        include: {
          publisher: { select: { id: true, name: true, avatar: true, verified: true } },
          reviews: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { id: true, name: true, avatar: true } } },
          },
        },
      });

      if (!product) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
      }

      // Check access for non-public products
      const isOwner = request.user?.id === product.publisherId;
      const isAdmin = request.user?.role === 'ADMIN';
      if (product.status !== ProductStatus.ACTIVE && !isOwner && !isAdmin) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
      }

      return reply.send({
        success: true,
        data: {
          ...product,
          priceAmount: Number(product.priceAmount),
          originalPriceAmount: product.originalPriceAmount ? Number(product.originalPriceAmount) : undefined,
          revenue: Number(product.revenue),
        },
      });
    }
  );

  // POST /api/products - Create product (publisher only)
  app.post('/', { schema: { body: CreateProductSchema } }, async (request, reply) => {
    if (!request.user || (request.user.role !== 'PUBLISHER' && request.user.role !== 'ADMIN')) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Publisher access required' } });
    }

    // Check slug uniqueness
    const existing = await prisma.product.findUnique({ where: { slug: request.body.slug } });
    if (existing) {
      return reply.status(409).send({ success: false, error: { code: 'SLUG_EXISTS', message: 'Slug already taken' } });
    }

    const data = request.body;
    const product = await prisma.product.create({
      data: {
        ...data,
        publisherId: request.user.id,
        publisherName: request.user.name || request.user.email,
        priceAmount: new Decimal(data.price.amount),
        priceCurrency: data.price.currency,
        priceInterval: data.price.interval,
        trialDays: data.price.trialDays,
        originalPriceAmount: data.originalPrice ? new Decimal(data.originalPrice.amount) : null,
        originalPriceCurrency: data.originalPrice?.currency,
        x402Network: data.x402Config?.network,
        x402FacilitatorUrl: data.x402Config?.facilitatorUrl,
        x402PricePerCall: data.x402Config?.pricePerCall,
        x402PayTo: data.x402Config?.payTo,
        x402ResourceUrl: data.x402Config?.resourceUrl,
        status: ProductStatus.PENDING_REVIEW,
      },
    });

    return reply.status(201).send({
      success: true,
      data: { ...product, priceAmount: Number(product.priceAmount) },
    });
  });

  // PATCH /api/products/:id - Update product
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { schema: { params: z.object({ id: z.string().uuid() }), body: UpdateProductSchema } },
    async (request, reply) => {
      const product = await prisma.product.findUnique({ where: { id: request.params.id } });
      if (!product) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
      }

      const isOwner = request.user?.id === product.publisherId;
      const isAdmin = request.user?.role === 'ADMIN';
      if (!isOwner && !isAdmin) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
      }

      const data = request.body;
      const updateData: any = { ...data };
      if (data.price) {
        updateData.priceAmount = new Decimal(data.price.amount);
        updateData.priceCurrency = data.price.currency;
        updateData.priceInterval = data.price.interval;
        updateData.trialDays = data.price.trialDays;
      }
      if (data.originalPrice) {
        updateData.originalPriceAmount = new Decimal(data.originalPrice.amount);
        updateData.originalPriceCurrency = data.originalPrice.currency;
      }
      if (data.x402Config) {
        updateData.x402Network = data.x402Config.network;
        updateData.x402FacilitatorUrl = data.x402Config.facilitatorUrl;
        updateData.x402PricePerCall = data.x402Config.pricePerCall;
        updateData.x402PayTo = data.x402Config.payTo;
        updateData.x402ResourceUrl = data.x402Config.resourceUrl;
      }

      const updated = await prisma.product.update({
        where: { id: request.params.id },
        data: updateData,
      });

      return reply.send({ success: true, data: { ...updated, priceAmount: Number(updated.priceAmount) } });
    }
  );

  // DELETE /api/products/:id - Delete product
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const product = await prisma.product.findUnique({ where: { id: request.params.id } });
      if (!product) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
      }

      const isOwner = request.user?.id === product.publisherId;
      const isAdmin = request.user?.role === 'ADMIN';
      if (!isOwner && !isAdmin) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
      }

      await prisma.product.delete({ where: { id: request.params.id } });
      return reply.send({ success: true, data: { message: 'Product deleted' } });
    }
  );

  // GET /api/products/categories - Get category stats
  app.get('/meta/categories', async (request, reply) => {
    const categories = await prisma.product.groupBy({
      by: ['category'],
      where: { status: ProductStatus.ACTIVE },
      _count: { category: true },
    });

    return reply.send({
      success: true,
      data: categories.map(c => ({ category: c.category, count: c._count.category })),
    });
  });

  // GET /api/products/featured - Get featured products
  app.get('/meta/featured', async (request, reply) => {
    const products = await prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      orderBy: [{ salesCount: 'desc' }, { rating: 'desc' }],
      take: 10,
      select: {
        id: true, slug: true, name: true, shortDescription: true,
        category: true, priceAmount: true, priceCurrency: true,
        images: true, rating: true, salesCount: true,
        publisherName: true, publisherVerified: true,
      },
    });

    return reply.send({
      success: true,
      data: products.map(p => ({ ...p, priceAmount: Number(p.priceAmount) })),
    });
  });
}