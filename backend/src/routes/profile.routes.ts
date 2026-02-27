import express from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireUser } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { getUserWithProfile, mapProfileResponse, updateUserProfile } from "../services/user.service.js";

const updateProfileSchema = z.object({
  diets: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  workoutLocations: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  macroVelocity: z.string().optional(),
  activityLevel: z.string().optional(),
  proteinG: z.number().int().min(1).max(600).optional(),
  carbsG: z.number().int().min(1).max(800).optional(),
  fatG: z.number().int().min(1).max(300).optional()
});

export const profileRouter = express.Router();

profileRouter.get(
  "/",
  requireUser,
  asyncHandler(async (req, res) => {
    const user = await getUserWithProfile(req.user!.userId);
    return res.status(200).json({ data: mapProfileResponse(user) });
  })
);

profileRouter.patch(
  "/",
  requireUser,
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const body = req.validatedBody as z.infer<typeof updateProfileSchema>;
    await updateUserProfile(req.user!.userId, body);
    const updated = await getUserWithProfile(req.user!.userId);
    return res.status(200).json({ data: mapProfileResponse(updated) });
  })
);
