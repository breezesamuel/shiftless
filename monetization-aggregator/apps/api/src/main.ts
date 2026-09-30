import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { Decimal } from 'decimal.js';

import { authRoutes } from './routes/auth';
import { productRoutes } from './routes/products';
import { orderRoutes } from './routes/orders';
import { subscriptionRoutes } from './routes/subscriptions';
import { referralRoutes } from './routes/referrals';
import { x402Routes } from './routes/x402';
import { skillRoutes } from './routes/skills';
import { analyticsRoutes } from './routes/analytics';
import { webhookRoutes } from './routes/webhooks';
import { healthRoutes } from './routes/health';

const prisma = new PrismaClient();

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: { colorize: true },
    } : undefined,
  },
});

// Security & CORS
await app.register(fastifyHelmet, {
  contentSecurityPolicy: false,
});
await app.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
});

// Rate Limiting
await app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
});

// JWT Auth
await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  sign: { expiresIn: '7d' },
  verify: { algorithms: ['HS256'] },
});

// Swagger Documentation
await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Monetization Aggregator API',
      description: 'Unified monetization platform API combining best practices from top 100 revenue websites',
      version: '1.0.0',
    },
    servers: [{ url: process.env.API_URL || 'http://localhost:4000', description: 'Development server' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
});
await app.register(fastifySwaggerUi, {
  routePrefix: '/docs',
  uiConfig: { docExpansion: 'list', deepLinking: true },
});

// Decorate Prisma client
app.decorate('prisma', prisma);

// Global error handler
app.setErrorHandler((error, request, reply) => {
  app.log.error(error);
  
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.validation },
    });
  }
  
  if (error.statusCode === 401) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }
  
  if (error.statusCode === 403) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
    });
  }
  
  return reply.status(500).send({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
});

// Authentication decorator
app.decorateRequest('user', null);

// Auth middleware
app.addHook('preHandler', async (request, reply) => {
  const publicPaths = ['/health', '/docs', '/api/auth', '/api/x402/pay', '/api/webhooks'];
  const isPublic = publicPaths.some(path => request.url.startsWith(path));
  
  if (!isPublic) {
    try {
      await request.jwtVerify();
      const user = await prisma.user.findUnique({ where: { id: request.user.id } });
      if (!user) throw new Error('User not found');
      request.user = user;
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
      });
    }
  }
});

// Register routes
await app.register(healthRoutes, { prefix: '/health' });
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(productRoutes, { prefix: '/api/products' });
await app.register(orderRoutes, { prefix: '/api/orders' });
await app.register(subscriptionRoutes, { prefix: '/api/subscriptions' });
await app.register(referralRoutes, { prefix: '/api/referrals' });
await app.register(x402Routes, { prefix: '/api/x402' });
await app.register(skillRoutes, { prefix: '/api/skills' });
await app.register(analyticsRoutes, { prefix: '/api/analytics' });
await app.register(webhookRoutes, { prefix: '/api/webhooks' });

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down gracefully...`);
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT) || 4000, host: '0.0.0.0' });
    app.log.info(`🚀 Server running on http://localhost:${process.env.PORT || 4000}`);
    app.log.info(`📚 API Docs: http://localhost:${process.env.PORT || 4000}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export { app };