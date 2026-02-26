import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { streamText, generateObject } from 'ai';
import { Response } from 'express';
import {
    mealPlanRepository,
    workoutRepository,
    shoppingRepository,
    userProfileRepository,
    weeklyMealPlanRepository,
} from '../../../infrastructure/repositories';
import { ForbiddenError } from '../../../infrastructure/errors';

// ─── AI Chat (Streaming) ──────────────────────────────────────────────────────

const contextSystemPrompts: Record<string, string> = {
    meal: 'You are a professional sports nutritionist. Provide precise, data-driven meal optimization advice. Keep responses concise and actionable.',
    workout: 'You are an elite strength and conditioning coach. Give expert exercise technique, programming, and recovery advice. Be direct and science-backed.',
    biometrics: 'You are a health data analyst. Interpret biometric trends and give clear health insights. Be encouraging but realistic.',
    dashboard: "You are a fitness performance coach analyzing a user's daily compliance data. Provide motivating, analytical summaries.",
    general: 'You are an expert AI fitness coach. Help users optimize their training and nutrition. Be professional and concise.',
};

export async function streamAIChat(
    context: string,
    message: string,
    res: Response,
): Promise<void> {
    const systemPrompt = contextSystemPrompts[context] ?? contextSystemPrompts.general;

    const result = await streamText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
        maxTokens: 512,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of result.textStream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const MealSchema = z.object({
    type: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
    name: z.string(),
    scheduledHour: z.number().int().min(0).max(23),
    calories: z.number().int(),
    proteinG: z.number(),
    carbsG: z.number(),
    fatG: z.number(),
    ingredients: z.array(z.string()),
    instructions: z.array(z.string()),
});

// Single-day response schema (used in the day-by-day loop)
const DailyMealResponseSchema = z.object({
    meals: z.array(MealSchema).min(1).max(8),
    dayIngredients: z.array(z.string()),
});

// Ingredients-only schema (lightweight, no instructions)
const IngredientItemSchema = z.object({
    type: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
    name: z.string(),
    calories: z.number().int(),
    proteinG: z.number(),
    carbsG: z.number(),
    fatG: z.number(),
    items: z.array(z.string()), // e.g. "2 eggs", "1 toast 20g", "1/2 milk cup (50ml)"
});

const IngredientsOnlyResponseSchema = z.object({
    meals: z.array(IngredientItemSchema).min(1).max(8),
    dayIngredients: z.array(z.string()),
});

const ShoppingListCategorizationSchema = z.object({
    items: z.array(
        z.object({
            name: z.string(),
            qty: z.string(),
            category: z.enum(['PROTEIN', 'CARBS', 'FATS', 'VEGGIES', 'DAIRY', 'OTHER']),
        })
    ),
});

const ExerciseSchema = z.object({
    name: z.string(),
    sets: z.string(),
    notes: z.string(),
});

const DayRoutineSchema = z.object({
    weekday: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
    name: z.string(),
    durationMin: z.number().int(),
    intensity: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
    exercises: z.array(ExerciseSchema),
});

const WorkoutPlanResponseSchema = z.object({
    routines: z.array(DayRoutineSchema),
});

// ─── Helper: Get User Profile Context ─────────────────────────────────────────

async function getUserProfileContext(userId: string) {
    const profile = await userProfileRepository.findByUserId(userId);
    return {
        goals: profile ? JSON.parse(profile.goals as string) : ['Build Muscle'],
        diets: profile ? JSON.parse(profile.diets as string) : ['No Preference'],
        allergies: profile ? JSON.parse(profile.allergies as string) : ['None'],
        proteinTarget: profile?.proteinG ?? 160,
        carbsTarget: profile?.carbsG ?? 220,
        fatTarget: profile?.fatG ?? 65,
        mealsPerDay: profile?.mealsPerDay ?? 3,
        dailyCalories: profile?.dailyCalories ?? 2500,
    };
}

// ─── Generate Weekly Meal Plan (Day-by-Day Microservice) ──────────────────────

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface DayBuffer {
    day: string;
    meals: z.infer<typeof MealSchema>[];
    dayIngredients: string[];
}

export async function generateWeeklyMealPlan(userId: string) {
    const ctx = await getUserProfileContext(userId);

    // In-memory accumulator
    const weekBuffer: DayBuffer[] = [];
    const allIngredients: string[] = [];

    for (let i = 0; i < 7; i++) {
        const dayName = WEEK_DAYS[i];

        const prompt = `Generate a single-day meal plan for ${dayName} for a fitness enthusiast:
- Goals: ${ctx.goals.join(', ')}
- Diet: ${ctx.diets.join(', ')}
- Allergies: ${ctx.allergies.join(', ')}
- Macro targets: ${ctx.proteinTarget}g protein, ${ctx.carbsTarget}g carbs, ${ctx.fatTarget}g fat
- Calorie target: ${ctx.dailyCalories} kcal
- Exactly ${ctx.mealsPerDay} meals

Vary the meals from previous days. Return realistic ingredients, step-by-step instructions, and a flat 'dayIngredients' array listing every ingredient needed for this day.`;

        const { object } = await generateObject({
            model: openai('gpt-4o-mini'),
            schema: DailyMealResponseSchema,
            prompt,
        });

        weekBuffer.push({
            day: dayName,
            meals: object.meals,
            dayIngredients: object.dayIngredients,
        });

        allIngredients.push(...object.dayIngredients);
    }

    // ── Flush to DB ────────────────────────────────────────────────────────────

    // 1. Save the entire week as WeeklyMealPlan JSON (for the meal plan view)
    const weeklyPlan = await weeklyMealPlanRepository.create(
        userId,
        weekBuffer.map((d) => ({ day: d.day, meals: d.meals })),
        allIngredients,
    );

    // 2. Decompose into DailyMealPlan + Meal rows (for dashboard & daily views)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(today);
        dayDate.setDate(today.getDate() + i);

        const dayData = weekBuffer[i];
        const totalCalories = dayData.meals.reduce((s, m) => s + m.calories, 0);
        const totalProteinG = dayData.meals.reduce((s, m) => s + m.proteinG, 0);
        const totalCarbsG = dayData.meals.reduce((s, m) => s + m.carbsG, 0);
        const totalFatG = dayData.meals.reduce((s, m) => s + m.fatG, 0);

        await mealPlanRepository.upsertForDate(userId, dayDate, {
            totalCalories,
            totalProteinG,
            totalCarbsG,
            totalFatG,
            meals: dayData.meals.map((m) => ({
                ...m,
                ingredients: JSON.stringify(m.ingredients) as any,
                instructions: JSON.stringify(m.instructions) as any,
            })),
        });
    }

    return weeklyPlan;
}

// ─── Generate Ingredients-Only Plan (Lightweight Prompt) ──────────────────────

export async function generateIngredientsOnlyPlan(userId: string) {
    const ctx = await getUserProfileContext(userId);

    const weekBuffer: { day: string; meals: z.infer<typeof IngredientItemSchema>[] }[] = [];
    const allIngredients: string[] = [];

    for (let i = 0; i < 7; i++) {
        const dayName = WEEK_DAYS[i];

        const prompt = `Generate a simple ingredient-only meal plan for ${dayName}. No recipes or instructions needed.
- Goals: ${ctx.goals.join(', ')}
- Diet: ${ctx.diets.join(', ')}
- Allergies: ${ctx.allergies.join(', ')}
- Macro targets: ${ctx.proteinTarget}g protein, ${ctx.carbsTarget}g carbs, ${ctx.fatTarget}g fat
- Calorie target: ${ctx.dailyCalories} kcal
- Exactly ${ctx.mealsPerDay} meals

For each meal, return 'items' as a simple list like: "2 eggs", "1 toast 20g", "1/2 milk cup (50ml)".
Also return a flat 'dayIngredients' array of all ingredients.`;

        const { object } = await generateObject({
            model: openai('gpt-4o-mini'),
            schema: IngredientsOnlyResponseSchema,
            prompt,
        });

        weekBuffer.push({ day: dayName, meals: object.meals });
        allIngredients.push(...object.dayIngredients);
    }

    // Save to WeeklyMealPlan JSON
    const weeklyPlan = await weeklyMealPlanRepository.create(
        userId,
        weekBuffer,
        allIngredients,
    );

    // Decompose into DailyMealPlan rows
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(today);
        dayDate.setDate(today.getDate() + i);

        const dayData = weekBuffer[i];
        const totalCalories = dayData.meals.reduce((s, m) => s + m.calories, 0);
        const totalProteinG = dayData.meals.reduce((s, m) => s + m.proteinG, 0);
        const totalCarbsG = dayData.meals.reduce((s, m) => s + m.carbsG, 0);
        const totalFatG = dayData.meals.reduce((s, m) => s + m.fatG, 0);

        await mealPlanRepository.upsertForDate(userId, dayDate, {
            totalCalories,
            totalProteinG,
            totalCarbsG,
            totalFatG,
            meals: dayData.meals.map((m) => ({
                type: m.type,
                name: m.name,
                scheduledHour: 8, // default
                calories: m.calories,
                proteinG: m.proteinG,
                carbsG: m.carbsG,
                fatG: m.fatG,
                ingredients: JSON.stringify(m.items) as any,
                instructions: JSON.stringify([]) as any,
            })),
        });
    }

    return weeklyPlan;
}

// ─── Generate Shopping List ───────────────────────────────────────────────────

export async function generateShoppingList(userId: string) {
    const weeklyPlan = await weeklyMealPlanRepository.findByUserId(userId);
    if (!weeklyPlan) {
        throw new Error('No weekly meal plan found. Generate a meal plan first.');
    }

    const ingredients = weeklyPlan.weeklyIngredients as string[];
    if (!ingredients || ingredients.length === 0) {
        throw new Error('Weekly meal plan has no ingredients.');
    }

    const prompt = `Here is a raw list of ingredients for a week's meal plan:
${ingredients.join('\n')}

Classify them exactly into these categories: 'PROTEIN', 'CARBS', 'FATS', 'VEGGIES', 'DAIRY', 'OTHER'. Give each a reasonable estimated quantity (e.g., '1 lb', '12 eggs', '1 bunch'). Consolidate duplicates by summing quantities.`;

    const { object } = await generateObject({
        model: openai('gpt-4o-mini'),
        schema: ShoppingListCategorizationSchema,
        prompt,
    });

    await shoppingRepository.deleteManyByUserId(userId);
    await shoppingRepository.createMany(
        object.items.map((i) => ({
            userId,
            name: i.name,
            qty: i.qty,
            category: i.category,
        }))
    );

    return object.items;
}

// ─── Get Saved Weekly Meal Plan ───────────────────────────────────────────────

export async function getWeeklyMealPlan(userId: string) {
    return weeklyMealPlanRepository.findByUserId(userId);
}

// ─── Get Daily Meal Plans ─────────────────────────────────────────────────────

export async function getDailyMealPlans(userId: string) {
    return mealPlanRepository.findByUserId(userId);
}

// ─── Get Today's Meal Plan ────────────────────────────────────────────────────

export async function getTodayMealPlan(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return mealPlanRepository.findByUserIdAndDate(userId, today);
}

// ─── Get Saved Shopping List ──────────────────────────────────────────────────

export async function getShoppingList(userId: string) {
    return shoppingRepository.findByUserId(userId);
}

// ─── Generate Workout Plan ────────────────────────────────────────────────────

export async function generateWorkoutPlan(userId: string, isPro: boolean) {
    if (!isPro) throw new ForbiddenError('Pro subscription required');

    const profile = await userProfileRepository.findByUserId(userId);
    const goals = profile ? JSON.parse(profile.goals as string) : ['Build Muscle'];
    const locations = profile ? JSON.parse(profile.workoutLocations as string) : ['GYM'];
    const activityLevel = profile?.activityLevel ?? 'MODERATELY_ACTIVE';

    const prompt = `Generate a full 7-day weekly workout routine for someone with:
- Goals: ${goals.join(', ')}
- Workout location: ${locations.join(', ')}
- Activity level: ${activityLevel}
Include all 7 days (rest days should have intensity NONE and no exercises). 
Active days should include 4-6 exercises with sets/reps notation and coaching notes.`;

    const { object } = await generateObject({
        model: openai('gpt-4o-mini'),
        schema: WorkoutPlanResponseSchema,
        prompt,
    });

    const savedRoutines = await Promise.all(
        object.routines.map((r) =>
            workoutRepository.upsertForWeekday(userId, r.weekday, {
                name: r.name,
                durationMin: r.durationMin,
                intensity: r.intensity,
                exercises: r.exercises.map((e, i) => ({ ...e, orderIdx: i })),
            }),
        ),
    );

    return savedRoutines;
}

// ─── Legacy: Generate Single-Day Meal Plan ────────────────────────────────────

export async function generateMealPlan(userId: string, isPro: boolean) {
    if (!isPro) throw new ForbiddenError('Pro subscription required');
    const ctx = await getUserProfileContext(userId);

    const prompt = `Generate a single day meal plan for a fitness enthusiast with these parameters:
- Goals: ${ctx.goals.join(', ')}
- Diet preference: ${ctx.diets.join(', ')}
- Allergies/exclusions: ${ctx.allergies.join(', ')}
- Daily macro targets: ${ctx.proteinTarget}g protein, ${ctx.carbsTarget}g carbs, ${ctx.fatTarget}g fat
Include 3-4 meals. Each meal must have realistic ingredients and step-by-step instructions.`;

    const { object } = await generateObject({
        model: openai('gpt-4o-mini'),
        schema: DailyMealResponseSchema,
        prompt,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalCalories = object.meals.reduce((s, m) => s + m.calories, 0);
    const totalProteinG = object.meals.reduce((s, m) => s + m.proteinG, 0);
    const totalCarbsG = object.meals.reduce((s, m) => s + m.carbsG, 0);
    const totalFatG = object.meals.reduce((s, m) => s + m.fatG, 0);

    const plan = await mealPlanRepository.create({
        userId,
        date: today,
        totalCalories,
        totalProteinG,
        totalCarbsG,
        totalFatG,
        meals: object.meals.map((m) => ({
            ...m,
            ingredients: JSON.stringify(m.ingredients) as any,
            instructions: JSON.stringify(m.instructions) as any,
        })),
    });

    return plan;
}
