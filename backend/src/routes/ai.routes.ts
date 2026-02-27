import express from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireUser } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  generateDietPlanFromMessage,
  generateShoppingListFromUpcomingMeals,
  generateWorkoutPlanFromMessage,
  getCustomerAiPlans
} from "../services/plan-generation.service.js";
import {
  getDailyMeals,
  getShoppingList,
  getTodaySnapshot,
  getWeeklyMealPlan,
  getWorkoutSchedule,
  setExerciseCompleted,
  setMealEaten
} from "../services/tracking.service.js";
import { getUserWithProfile } from "../services/user.service.js";

const sharedChatSchema = z.object({
  customerId: z.union([z.string(), z.number()]).optional(),
  message: z.string().trim().min(1).max(4000)
});

const updateEatenSchema = z.object({
  eaten: z.boolean()
});

const updateCompletedSchema = z.object({
  completed: z.boolean()
});

export const aiRouter = express.Router();

aiRouter.post(
  "/diet/message",
  requireUser,
  validateBody(sharedChatSchema),
  asyncHandler(async (req, res) => {
    const body = req.validatedBody as z.infer<typeof sharedChatSchema>;
    const user = await getUserWithProfile(req.user!.userId);
    const data = await generateDietPlanFromMessage({ user, message: body.message });
    return res.status(200).json({ data });
  })
);

aiRouter.post(
  "/workout/message",
  requireUser,
  validateBody(sharedChatSchema),
  asyncHandler(async (req, res) => {
    const body = req.validatedBody as z.infer<typeof sharedChatSchema>;
    const user = await getUserWithProfile(req.user!.userId);
    const data = await generateWorkoutPlanFromMessage({ user, message: body.message });
    return res.status(200).json({ data });
  })
);

aiRouter.get(
  "/customers/:customerId/ai-plans",
  requireUser,
  asyncHandler(async (req, res) => {
    const customerId = String(req.params.customerId);
    if (customerId !== req.user!.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const data = await getCustomerAiPlans(customerId);
    return res.status(200).json({ data });
  })
);

aiRouter.post(
  "/generate-weekly-meal-plan",
  requireUser,
  asyncHandler(async (req, res) => {
    const user = await getUserWithProfile(req.user!.userId);
    const data = await generateDietPlanFromMessage({
      user,
      message: "Create a fresh weekly meal plan based on my profile."
    });
    return res.status(200).json({ data });
  })
);

aiRouter.get(
  "/weekly-meal-plan",
  requireUser,
  asyncHandler(async (req, res) => {
    const data = await getWeeklyMealPlan(req.user!.userId);
    return res.status(200).json({ data });
  })
);

aiRouter.get(
  "/daily-meals",
  requireUser,
  asyncHandler(async (req, res) => {
    const data = await getDailyMeals(req.user!.userId);
    return res.status(200).json({ data });
  })
);

aiRouter.put(
  "/meals/:mealId/eaten",
  requireUser,
  validateBody(updateEatenSchema),
  asyncHandler(async (req, res) => {
    const body = req.validatedBody as z.infer<typeof updateEatenSchema>;
    const mealId = Number(req.params.mealId);
    const updated = await setMealEaten(req.user!.userId, mealId, body.eaten);
    return res.status(200).json({ data: updated });
  })
);

aiRouter.post(
  "/generate-workout-plan",
  requireUser,
  asyncHandler(async (req, res) => {
    const user = await getUserWithProfile(req.user!.userId);
    const data = await generateWorkoutPlanFromMessage({
      user,
      message: "Create a fresh weekly workout plan based on my profile."
    });
    return res.status(200).json({ data });
  })
);

aiRouter.get(
  "/workout-plan",
  requireUser,
  asyncHandler(async (req, res) => {
    const data = await getWorkoutSchedule(req.user!.userId);
    return res.status(200).json({ data });
  })
);

aiRouter.put(
  "/exercises/:exerciseLogId/completed",
  requireUser,
  validateBody(updateCompletedSchema),
  asyncHandler(async (req, res) => {
    const body = req.validatedBody as z.infer<typeof updateCompletedSchema>;
    const exerciseLogId = Number(req.params.exerciseLogId);
    const data = await setExerciseCompleted(req.user!.userId, exerciseLogId, body.completed);
    return res.status(200).json({ data });
  })
);

aiRouter.post(
  "/generate-shopping-list",
  requireUser,
  asyncHandler(async (req, res) => {
    const data = await generateShoppingListFromUpcomingMeals(req.user!.userId);
    return res.status(200).json({ data });
  })
);

aiRouter.get(
  "/shopping-list",
  requireUser,
  asyncHandler(async (req, res) => {
    const data = await getShoppingList(req.user!.userId);
    return res.status(200).json({ data });
  })
);

aiRouter.get(
  "/today",
  requireUser,
  asyncHandler(async (req, res) => {
    const data = await getTodaySnapshot(req.user!.userId);
    return res.status(200).json({ data });
  })
);
