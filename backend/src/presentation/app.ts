import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes';
import aiRoutes from './routes/ai.routes';
import billingRoutes from './routes/billing.routes';
import profileRoutes from './routes/profile.routes';
import biometricsRoutes from './routes/biometrics.routes';
import shoppingRoutes from './routes/shopping.routes';
import friendsRoutes from './routes/friends.routes';
import invitesRoutes from './routes/invites.routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler.middleware';
import { logger } from '../infrastructure/logger';
import { prisma } from '../infrastructure/database/prisma';

export function createApp() {
    const app = express();

    // ─── Security ──────────────────────────────────────────────────────────────
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);
    app.use(
        cors({
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error(`CORS: ${origin} not allowed`));
                }
            },
            credentials: true,
        }),
    );

    // ─── Rate Limiting ──────────────────────────────────────────────────────────
    const globalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
    });

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        skipSuccessfulRequests: true,
        standardHeaders: true,
        legacyHeaders: false,
    });

    app.use(globalLimiter);

    // ─── Body Parsing ───────────────────────────────────────────────────────────
    // Stripe webhook needs raw body — must come BEFORE express.json
    app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());
    app.use(compression() as any);

    // ─── Request Logger ─────────────────────────────────────────────────────────
    app.use((req, _res, next) => {
        logger.info({ method: req.method, url: req.url }, 'Incoming request');
        next();
    });

    // ─── Health Check ───────────────────────────────────────────────────────────
    app.get('/api/health', async (_req, res) => {
        try {
            await prisma.$queryRaw`SELECT 1`;
            res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
        } catch {
            res.status(503).json({ status: 'degraded', db: 'disconnected', timestamp: new Date().toISOString() });
        }
    });

    // ─── API Routes ─────────────────────────────────────────────────────────────
    app.use('/api/v1/auth', authLimiter, authRoutes);
    app.use('/api/v1/ai', aiRoutes);
    app.use('/api/v1/billing', billingRoutes);
    app.use('/api/v1/profile', profileRoutes);
    app.use('/api/v1/biometrics', biometricsRoutes);
    app.use('/api/v1/shopping', shoppingRoutes);
    app.use('/api/v1/friends', friendsRoutes);
    app.use('/api/v1/invites', invitesRoutes);

    // ─── Error Handling ─────────────────────────────────────────────────────────
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
