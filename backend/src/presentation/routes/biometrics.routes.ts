import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { biometricRepository } from '../../infrastructure/repositories';

const router = Router();

// GET /api/v1/biometrics
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const entries = await biometricRepository.findByUserId(req.user!.userId);
        res.json({ message: 'Biometrics fetched', data: entries });
    } catch (err) {
        next(err);
    }
});

const LogBiometricSchema = z.object({
    body: z.object({
        weightKg: z.number().min(25).max(400),
        bodyFatPct: z.number().min(0).max(100).nullable().optional(),
        waistCm: z.number().min(30).max(300).nullable().optional(),
        chestCm: z.number().min(30).max(300).nullable().optional(),
    }),
});

// POST /api/v1/biometrics
router.post('/', authenticate, validate(LogBiometricSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const entry = await biometricRepository.create({
            userId: req.user!.userId,
            weightKg: req.body.weightKg,
            bodyFatPct: req.body.bodyFatPct ?? null,
            waistCm: req.body.waistCm ?? null,
            chestCm: req.body.chestCm ?? null,
        });
        res.status(201).json({ message: 'Biometric entry logged', data: entry });
    } catch (err) {
        next(err);
    }
});

export default router;
