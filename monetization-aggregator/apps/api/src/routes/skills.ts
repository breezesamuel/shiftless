import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient, SkillStatus, SkillCategory, SkillLicenseType } from '@prisma/client';
import { Decimal } from 'decimal.js';

const CreateSkillSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().max(200),
  description: z.string().max(5000),
  category: z.nativeEnum(SkillCategory),
  priceAmount: z.number().positive(),
  priceCurrency: z.string().default('USD'),
  licenseType: z.nativeEnum(SkillLicenseType),
  repositoryUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
  demoUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  mcpCompatible: z.boolean().default(false),
  mcpConfig: z.record(z.unknown()).optional(),
});

const UpdateSkillSchema = CreateSkillSchema.partial();

const SkillQuerySchema = z.object({
  category: z.nativeEnum(SkillCategory).optional(),
  licenseType: z.nativeEnum(SkillLicenseType).optional(),
  status: z.nativeEnum(SkillStatus).optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['createdAt', 'installCount', 'rating', 'price']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export async function skillRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // GET /api/skills - List skills
  app.get('/', { schema: { querystring: SkillQuerySchema } }, async (request, reply) => {
    const { category, licenseType, status, search, tags, sortBy, sortOrder, page, pageSize } = request.query as z.infer<typeof SkillQuerySchema>;

    const where: any = {};
    if (category) where.category = category;
    if (licenseType) where.licenseType = licenseType;
    if (status) where.status = status;
    else where.status = SkillStatus.ACTIVE; // Default to active only
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ];
    }
    if (tags?.length) where.tags = { hasEvery: tags };

    const [skills, total] = await Promise.all([
      prisma.skill.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          publisher: { select: { id: true, name: true, avatar: true, verified: true } },
        },
      }),
      prisma.skill.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: skills.map(s => ({
        ...s,
        priceAmount: Number(s.priceAmount),
        revenue: Number(s.revenue),
      })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  });

  // GET /api/skills/:id - Get skill details
  app.get<{ Params: { id: string } }>(
    '/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const skill = await prisma.skill.findUnique({
        where: { id: request.params.id },
        include: {
          publisher: { select: { id: true, name: true, avatar: true, verified: true } },
        },
      });

      if (!skill) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Skill not found' } });
      }

      return reply.send({
        success: true,
        data: { ...skill, priceAmount: Number(skill.priceAmount), revenue: Number(skill.revenue) },
      });
    }
  );

  // POST /api/skills - Create skill (publisher)
  app.post('/', { schema: { body: CreateSkillSchema } }, async (request, reply) => {
    const existing = await prisma.skill.findUnique({ where: { slug: request.body.slug } });
    if (existing) {
      return reply.status(409).send({ success: false, error: { code: 'SLUG_EXISTS', message: 'Slug already taken' } });
    }

    const skill = await prisma.skill.create({
      data: {
        ...request.body,
        publisherId: request.user.id,
        publisherName: request.user.name || request.user.email,
        priceAmount: new Decimal(request.body.priceAmount),
        status: SkillStatus.REVIEW,
      },
    });

    return reply.status(201).send({ success: true, data: { ...skill, priceAmount: Number(skill.priceAmount) } });
  });

  // PATCH /api/skills/:id - Update skill
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { schema: { params: z.object({ id: z.string().uuid() }), body: UpdateSkillSchema } },
    async (request, reply) => {
      const skill = await prisma.skill.findUnique({ where: { id: request.params.id } });
      if (!skill) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Skill not found' } });
      }

      if (skill.publisherId !== request.user.id && request.user.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
      }

      const data = request.body;
      const updateData: any = { ...data };
      if (data.priceAmount) updateData.priceAmount = new Decimal(data.priceAmount);

      const updated = await prisma.skill.update({ where: { id: request.params.id }, data: updateData });
      return reply.send({ success: true, data: { ...updated, priceAmount: Number(updated.priceAmount) } });
    }
  );

  // POST /api/skills/:id/install - Record skill installation
  app.post<{ Params: { id: string } }>(
    '/:id/install',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const skill = await prisma.skill.findUnique({ where: { id: request.params.id } });
      if (!skill || skill.status !== SkillStatus.ACTIVE) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Skill not available' } });
      }

      await prisma.skill.update({
        where: { id: request.params.id },
        data: { installCount: { increment: 1 } },
      });

      return reply.send({ success: true, data: { message: 'Install recorded', installCount: skill.installCount + 1 } });
    }
  );

  // GET /api/skills/categories - Get category stats
  app.get('/meta/categories', async (request, reply) => {
    const categories = await prisma.skill.groupBy({
      by: ['category'],
      where: { status: SkillStatus.ACTIVE },
      _count: { category: true },
    });

    return reply.send({
      success: true,
      data: categories.map(c => ({ category: c.category, count: c._count.category })),
    });
  });
}