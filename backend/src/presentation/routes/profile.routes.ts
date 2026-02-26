import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { userProfileRepository, userRepository } from '../../infrastructure/repositories';

const router = Router();

// GET /api/v1/profile
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await userRepository.findById(req.user!.userId);
        const profile = await userProfileRepository.findByUserId(req.user!.userId);
        if (!user) {
            res.status(404).json({ message: 'User not found', data: null });
            return;
        }
        res.json({
            message: 'Profile fetched',
            data: {
                id: user.id,
                email: user.email,
                isPro: user.isPro,
                subscriptionTier: user.subscriptionTier,
                profile: profile
                    ? {
                        ...profile,
                        goals: JSON.parse(profile.goals as string),
                        workoutLocations: JSON.parse(profile.workoutLocations as string),
                        diets: JSON.parse(profile.diets as string),
                        allergies: JSON.parse(profile.allergies as string),
                        macroTargets: {
                            proteinG: profile.proteinG,
                            carbsG: profile.carbsG,
                            fatG: profile.fatG,
                        },
                    }
                    : null,
            },
        });
    } catch (err) {
        next(err);
    }
});

const UpdateProfileSchema = z.object({
    body: z.object({
        goals: z.array(z.string()).optional(),
        workoutLocations: z.array(z.string()).optional(),
        diets: z.array(z.string()).optional(),
        allergies: z.array(z.string()).optional(),
        activityLevel: z.enum(['SEDENTARY', 'LIGHTLY_ACTIVE', 'MODERATELY_ACTIVE', 'VERY_ACTIVE', 'ATHLETE']).optional(),
        macroVelocity: z.enum(['SLOW', 'AI_RECOMMENDED', 'FAST']).optional(),
        proteinG: z.number().int().optional(),
        carbsG: z.number().int().optional(),
        fatG: z.number().int().optional(),
        weightKg: z.number().optional(),
        targetWeightKg: z.number().optional(),
    }),
});

// PATCH /api/v1/profile
router.patch('/', authenticate, validate(UpdateProfileSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body;
        const existing = await userProfileRepository.findByUserId(req.user!.userId);
        if (!existing) {
            res.status(404).json({ message: 'Profile not found', data: null });
            return;
        }

        const updated = await userProfileRepository.upsert(req.user!.userId, {
            userId: req.user!.userId,
            gender: existing.gender,
            ageYrs: existing.ageYrs,
            heightCm: existing.heightCm,
            weightKg: body.weightKg ?? existing.weightKg,
            targetWeightKg: body.targetWeightKg ?? existing.targetWeightKg,
            goals: body.goals ? JSON.stringify(body.goals) : (existing.goals as string),
            workoutLocations: body.workoutLocations ? JSON.stringify(body.workoutLocations) : (existing.workoutLocations as string),
            diets: body.diets ? JSON.stringify(body.diets) : (existing.diets as string),
            allergies: body.allergies ? JSON.stringify(body.allergies) : (existing.allergies as string),
            activityLevel: (body.activityLevel ?? existing.activityLevel) as any,
            macroVelocity: (body.macroVelocity ?? existing.macroVelocity) as any,
            proteinG: body.proteinG ?? existing.proteinG,
            carbsG: body.carbsG ?? existing.carbsG,
            fatG: body.fatG ?? existing.fatG,
        });

        res.json({ message: 'Profile updated', data: updated });
    } catch (err) {
        next(err);
    }
});

export default router;
