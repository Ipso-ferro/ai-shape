import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { userRepository, userProfileRepository } from '../../../infrastructure/repositories';
import { ConflictError, UnauthorizedError, ValidationError } from '../../../infrastructure/errors';
import type { JWTPayload } from '../../../presentation/middleware/auth.middleware';

// ─── Validation Schemas ───────────────────────────────────────────────────────

export const RegisterSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        gender: z.enum(['MALE', 'FEMALE']),
        ageYrs: z.number().int().min(16).max(110),
        heightCm: z.number().min(120).max(220),
        weightKg: z.number().min(25).max(400),
        targetWeightKg: z.number().min(25).max(400),
        goals: z.array(z.string()).min(1),
        workoutLocations: z.array(z.string()).min(1),
        diets: z.array(z.string()).min(1),
        allergies: z.array(z.string()).min(1),
        activityLevel: z.enum(['SEDENTARY', 'LIGHTLY_ACTIVE', 'MODERATELY_ACTIVE', 'VERY_ACTIVE', 'ATHLETE']),
        mealsPerDay: z.number().int().min(1).max(6).optional().default(3),
    }),
});

export const LoginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(1),
    }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeMacros(
    weightKg: number,
    targetWeightKg: number,
    activityLevel: string,
    goals: string[]
): { dailyCalories: number; proteinG: number; carbsG: number; fatG: number } {
    const activityMultipliers: Record<string, number> = {
        SEDENTARY: 1.2,
        LIGHTLY_ACTIVE: 1.375,
        MODERATELY_ACTIVE: 1.55,
        VERY_ACTIVE: 1.725,
        ATHLETE: 1.9,
    };
    const multiplier = activityMultipliers[activityLevel] ?? 1.55;
    const avgWeight = (weightKg + targetWeightKg) / 2;
    const tdee = avgWeight * 22 * multiplier;

    let dailyCalories = Math.round(tdee);
    const goalsStr = goals.join(' ').toLowerCase();

    if (goalsStr.includes('lose weight')) {
        dailyCalories -= 500; // Caloric deficit
    } else if (goalsStr.includes('build muscle')) {
        dailyCalories += 300; // Caloric surplus
    }

    const proteinG = Math.round(avgWeight * 2.2);
    const fatG = Math.round((dailyCalories * 0.25) / 9);
    const carbsG = Math.round((dailyCalories - proteinG * 4 - fatG * 9) / 4);

    return { dailyCalories: Math.max(dailyCalories, 1200), proteinG: Math.max(proteinG, 100), carbsG: Math.max(carbsG, 100), fatG: Math.max(fatG, 40) };
}

function signToken(payload: JWTPayload): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

// ─── Use Cases ────────────────────────────────────────────────────────────────

export async function registerUser(body: z.infer<typeof RegisterSchema>['body']) {
    const { email, password, gender, ageYrs, heightCm, weightKg, targetWeightKg, goals, workoutLocations, diets, allergies, activityLevel, mealsPerDay } = body;

    const existing = await userRepository.findByEmail(email);
    if (existing) throw new ConflictError('An account with this email already exists');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userRepository.create({ email, passwordHash });

    const macros = computeMacros(weightKg, targetWeightKg, activityLevel, goals);

    await userProfileRepository.upsert(user.id, {
        userId: user.id,
        gender: gender as any,
        ageYrs,
        heightCm,
        weightKg,
        targetWeightKg,
        goals: JSON.stringify(goals),
        workoutLocations: JSON.stringify(workoutLocations),
        diets: JSON.stringify(diets),
        allergies: JSON.stringify(allergies),
        activityLevel: activityLevel as any,
        macroVelocity: 'AI_RECOMMENDED',
        dailyCalories: macros.dailyCalories,
        mealsPerDay: mealsPerDay,
        proteinG: macros.proteinG,
        carbsG: macros.carbsG,
        fatG: macros.fatG,
    });

    const token = signToken({ userId: user.id, email: user.email, isPro: false });
    return { token, isPro: false };
}

export async function loginUser(email: string, password: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    const isPro = user.isPro;
    const token = signToken({ userId: user.id, email: user.email, isPro });
    return { token, isPro };
}

export async function refreshToken(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError('User not found');

    const isPro = user.isPro;
    const token = signToken({ userId: user.id, email: user.email, isPro });
    return { token, isPro };
}
