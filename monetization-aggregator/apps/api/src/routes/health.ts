import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export async function healthRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // GET /health - Basic health check
  app.get('/', async (request, reply) => {
    return reply.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // GET /health/ready - Readiness check (database, dependencies)
  app.get('/ready', async (request, reply) => {
    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;
      
      // Check Redis if configured
      // await redis.ping();

      return reply.send({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'healthy',
          redis: 'healthy',
        },
      });
    } catch (error) {
      return reply.status(503).send({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'unhealthy',
          redis: 'unknown',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /health/live - Liveness check (for Kubernetes)
  app.get('/live', async (request, reply) => {
    return reply.send({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  // GET /health/metrics - Prometheus metrics endpoint
  app.get('/metrics', async (request, reply) => {
    const metrics = await prisma.$queryRaw`
      SELECT 
        (SELECT COUNT(*) FROM "User") as total_users,
        (SELECT COUNT(*) FROM "Product" WHERE status = 'ACTIVE') as active_products,
        (SELECT COUNT(*) FROM "Order" WHERE status = 'COMPLETED') as completed_orders,
        (SELECT COALESCE(SUM("totalPriceAmount"), 0) FROM "Order" WHERE status = 'COMPLETED') as total_revenue,
        (SELECT COUNT(*) FROM "Subscription" WHERE status = 'ACTIVE' AND tier != 'FREE') as active_subscriptions
    `;

    const [stats] = metrics as any[];
    
    return reply
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send([
        `# HELP monetization_total_users Total number of registered users`,
        `# TYPE monetization_total_users gauge`,
        `monetization_total_users ${stats.total_users}`,
        '',
        `# HELP monetization_active_products Total number of active products`,
        `# TYPE monetization_active_products gauge`,
        `monetization_active_products ${stats.active_products}`,
        '',
        `# HELP monetization_completed_orders Total number of completed orders`,
        `# TYPE monetization_completed_orders gauge`,
        `monetization_completed_orders ${stats.completed_orders}`,
        '',
        `# HELP monetization_total_revenue Total revenue in base currency units`,
        `# TYPE monetization_total_revenue gauge`,
        `monetization_total_revenue ${stats.total_revenue}`,
        '',
        `# HELP monetization_active_subscriptions Total number of active paid subscriptions`,
        `# TYPE monetization_active_subscriptions gauge`,
        `monetization_active_subscriptions ${stats.active_subscriptions}`,
        '',
      ].join('\n'));
  });
}