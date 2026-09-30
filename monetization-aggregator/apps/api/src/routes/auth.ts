import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateReferralCode } from '@monetization/shared';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().max(100).optional(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  referralCode: z.string().length(8).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const RefreshSchema = z.object({
  refreshToken: z.string(),
});

const WalletAuthSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string(),
  message: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // POST /api/auth/register
  app.post<{ Body: z.infer<typeof RegisterSchema> }>(
    '/register',
    {
      schema: {
        body: RegisterSchema,
        response: {
          201: z.object({
            success: z.boolean(),
            data: z.object({
              user: z.object({
                id: z.string(),
                email: z.string(),
                name: z.string().nullable(),
                role: z.string(),
                referralCode: z.string(),
              }),
              accessToken: z.string(),
              refreshToken: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { email, password, name, walletAddress, referralCode } = request.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return reply.status(409).send({
          success: false,
          error: { code: 'EMAIL_EXISTS', message: 'Email already registered' },
        });
      }

      if (walletAddress) {
        const existingWallet = await prisma.user.findUnique({ where: { walletAddress } });
        if (existingWallet) {
          return reply.status(409).send({
            success: false,
            error: { code: 'WALLET_EXISTS', message: 'Wallet already linked to an account' },
          });
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Handle referral
      let referredById: string | null = null;
      if (referralCode) {
        const referrer = await prisma.user.findUnique({ where: { referralCode } });
        if (referrer) {
          referredById = referrer.id;
        }
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          walletAddress,
          role: UserRole.FREE,
          referralCode: generateReferralCode(),
          referredById,
        },
      });

      // Generate tokens
      const accessToken = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: '15m' }
      );
      const refreshToken = app.jwt.sign(
        { id: user.id, type: 'refresh' },
        { expiresIn: '7d' }
      );

      // Store refresh token
      await prisma.session.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            referralCode: user.referralCode,
          },
          accessToken,
          refreshToken,
        },
      });
    }
  );

  // POST /api/auth/login
  app.post<{ Body: z.infer<typeof LoginSchema> }>(
    '/login',
    {
      schema: {
        body: LoginSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.object({
              user: z.object({
                id: z.string(),
                email: z.string(),
                name: z.string().nullable(),
                role: z.string(),
                referralCode: z.string(),
              }),
              accessToken: z.string(),
              refreshToken: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) {
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        });
      }

      const accessToken = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: '15m' }
      );
      const refreshToken = app.jwt.sign(
        { id: user.id, type: 'refresh' },
        { expiresIn: '7d' }
      );

      await prisma.session.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            referralCode: user.referralCode,
          },
          accessToken,
          refreshToken,
        },
      });
    }
  );

  // POST /api/auth/wallet - Web3 wallet authentication
  app.post<{ Body: z.infer<typeof WalletAuthSchema> }>(
    '/wallet',
    {
      schema: {
        body: WalletAuthSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.object({
              user: z.object({
                id: z.string(),
                email: z.string(),
                walletAddress: z.string(),
                role: z.string(),
                referralCode: z.string(),
              }),
              accessToken: z.string(),
              refreshToken: z.string(),
              isNewUser: z.boolean(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { walletAddress, signature, message } = request.body;

      // Verify signature (in production, use proper EIP-191 verification)
      // For now, we trust the wallet address

      let user = await prisma.user.findUnique({ where: { walletAddress } });
      let isNewUser = false;

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: `${walletAddress.slice(0, 10)}@web3.user`,
            walletAddress,
            role: UserRole.FREE,
            referralCode: generateReferralCode(),
          },
        });
        isNewUser = true;
      }

      const accessToken = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: '15m' }
      );
      const refreshToken = app.jwt.sign(
        { id: user.id, type: 'refresh' },
        { expiresIn: '7d' }
      );

      await prisma.session.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            walletAddress: user.walletAddress,
            role: user.role,
            referralCode: user.referralCode,
          },
          accessToken,
          refreshToken,
          isNewUser,
        },
      });
    }
  );

  // POST /api/auth/refresh
  app.post<{ Body: z.infer<typeof RefreshSchema> }>(
    '/refresh',
    {
      schema: {
        body: RefreshSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.object({
              accessToken: z.string(),
              refreshToken: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body;

      const session = await prisma.session.findUnique({ where: { token: refreshToken } });
      if (!session || session.expiresAt < new Date()) {
        return reply.status(401).send({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Refresh token expired' },
        });
      }

      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) {
        return reply.status(401).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      // Rotate refresh token
      await prisma.session.delete({ where: { id: session.id } });
      const newRefreshToken = app.jwt.sign(
        { id: user.id, type: 'refresh' },
        { expiresIn: '7d' }
      );

      await prisma.session.create({
        data: {
          userId: user.id,
          token: newRefreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const accessToken = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: '15m' }
      );

      return reply.send({
        success: true,
        data: { accessToken, refreshToken: newRefreshToken },
      });
    }
  );

  // POST /api/auth/logout
  app.post('/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const decoded = app.jwt.verify(token);
        await prisma.session.deleteMany({ where: { userId: decoded.id } });
      } catch {}
    }
    return reply.send({ success: true, data: { message: 'Logged out successfully' } });
  });

  // GET /api/auth/me
  app.get('/me', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        walletAddress: true,
        referralCode: true,
        subscription: true,
        createdAt: true,
      },
    });

    return reply.send({
      success: true,
      data: { user },
    });
  });
}