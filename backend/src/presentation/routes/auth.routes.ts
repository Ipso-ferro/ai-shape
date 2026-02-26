import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { registerUser, loginUser, refreshToken, RegisterSchema, LoginSchema } from '../../application/use-cases/auth/auth.use-cases';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// POST /api/v1/auth/register
router.post('/register', validate(RegisterSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await registerUser(req.body);
        res.cookie('probody_token', result.token, COOKIE_OPTIONS);
        res.status(201).json({ message: 'Account created successfully', data: { isPro: result.isPro } });
    } catch (err) {
        next(err);
    }
});

// POST /api/v1/auth/login
router.post('/login', validate(LoginSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;
        const result = await loginUser(email, password);
        res.cookie('probody_token', result.token, COOKIE_OPTIONS);
        res.json({ message: 'Login successful', data: { isPro: result.isPro } });
    } catch (err) {
        next(err);
    }
});

// POST /api/v1/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
    res.clearCookie('probody_token');
    res.json({ message: 'Logged out successfully', data: null });
});

// POST /api/v1/auth/refresh — reads cookie, returns current isPro
router.post('/refresh', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await refreshToken(req.user!.userId);
        res.cookie('probody_token', result.token, COOKIE_OPTIONS);
        res.json({ message: 'Token refreshed', data: { isPro: result.isPro } });
    } catch (err) {
        next(err);
    }
});

export default router;
