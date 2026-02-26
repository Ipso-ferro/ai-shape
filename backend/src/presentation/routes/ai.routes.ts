import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePro } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
    streamAIChat,
    generateMealPlan,
    generateWorkoutPlan,
    generateWeeklyMealPlan,
    generateIngredientsOnlyPlan,
    generateShoppingList,
    getWeeklyMealPlan,
    getDailyMealPlans,
    getTodayMealPlan,
    getShoppingList,
} from '../../application/use-cases/ai/ai.use-cases';

const router = Router();

const ChatSchema = z.object({
    body: z.object({
        message: z.string().min(1),
        context: z.enum(['meal', 'workout', 'biometrics', 'dashboard', 'general']).default('general'),
    }),
});

// POST /api/v1/ai/chat — streaming SSE, Pro required
router.post('/chat', authenticate, requirePro, validate(ChatSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { message, context } = req.body;
        await streamAIChat(context, message, res);
    } catch (err) {
        next(err);
    }
});

// POST /api/v1/ai/generate-meal-plan (legacy single-day)
router.post('/generate-meal-plan', authenticate, requirePro, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const plan = await generateMealPlan(req.user!.userId, req.user!.isPro);
        res.json({ message: 'Meal plan generated', data: plan });
    } catch (err) {
        next(err);
    }
});

// POST /api/v1/ai/generate-workout-plan
router.post('/generate-workout-plan', authenticate, requirePro, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const routines = await generateWorkoutPlan(req.user!.userId, req.user!.isPro);
        res.json({ message: 'Workout plan generated', data: routines });
    } catch (err) {
        next(err);
    }
});

// POST /api/v1/ai/generate-weekly-meal-plan (day-by-day, full recipes)
router.post('/generate-weekly-meal-plan', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const plan = await generateWeeklyMealPlan(req.user!.userId);
        res.json({ message: 'Weekly meal plan generated', data: plan });
    } catch (err) {
        next(err);
    }
});

// POST /api/v1/ai/generate-ingredients-only (day-by-day, lightweight)
router.post('/generate-ingredients-only', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const plan = await generateIngredientsOnlyPlan(req.user!.userId);
        res.json({ message: 'Ingredients-only plan generated', data: plan });
    } catch (err) {
        next(err);
    }
});

// POST /api/v1/ai/generate-shopping-list
router.post('/generate-shopping-list', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const items = await generateShoppingList(req.user!.userId);
        res.json({ message: 'Shopping list generated successfully', data: items });
    } catch (err) {
        next(err);
    }
});

// GET /api/v1/ai/weekly-meal-plan
router.get('/weekly-meal-plan', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const plan = await getWeeklyMealPlan(req.user!.userId);
        res.json({ message: 'Fetched weekly meal plan', data: plan });
    } catch (err) {
        next(err);
    }
});

// GET /api/v1/ai/daily-meals — returns last 14 daily meal plan rows
router.get('/daily-meals', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const plans = await getDailyMealPlans(req.user!.userId);
        res.json({ message: 'Fetched daily meal plans', data: plans });
    } catch (err) {
        next(err);
    }
});

// GET /api/v1/ai/today — returns today's meal plan with meals
router.get('/today', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const plan = await getTodayMealPlan(req.user!.userId);
        res.json({ message: 'Fetched today meal plan', data: plan });
    } catch (err) {
        next(err);
    }
});

// GET /api/v1/ai/shopping-list
router.get('/shopping-list', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const items = await getShoppingList(req.user!.userId);
        res.json({ message: 'Fetched shopping list', data: items });
    } catch (err) {
        next(err);
    }
});

export default router;
