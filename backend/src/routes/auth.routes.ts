import express from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/async-handler.js";
import { attachUserFromCookie, requireUser } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { AUTH_COOKIE_NAME, signAuthToken } from "../utils/jwt.js";
import { getUserWithProfile, loginUser, mapProfileResponse, registerUser } from "../services/user.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  gender: z.string(),
  ageYrs: z.number().int().min(15).max(120),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(25).max(250),
  targetWeightKg: z.number().min(25).max(250),
  goals: z.array(z.string()).min(1),
  workoutLocations: z.array(z.string()).min(1),
  diets: z.array(z.string()).min(1),
  allergies: z.array(z.string()).min(1),
  activityLevel: z.string().min(3),
  mealsPerDay: z.number().int().min(1).max(6)
});

const refreshSchema = z.object({}).passthrough();

function setAuthCookie(res: express.Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 14
  });
}

export const authRouter = express.Router();

authRouter.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const payload = req.validatedBody as z.infer<typeof registerSchema>;
    const user = await registerUser(payload);
    const token = signAuthToken({ userId: user.id, email: user.email });
    setAuthCookie(res, token);

    return res.status(201).json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          isPro: user.isPro,
          subscriptionTier: user.subscriptionTier
        }
      }
    });
  })
);

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const payload = req.validatedBody as z.infer<typeof loginSchema>;
    const user = await loginUser(payload.email, payload.password);
    const token = signAuthToken({ userId: user.id, email: user.email });
    setAuthCookie(res, token);
    return res.status(200).json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          isPro: user.isPro,
          subscriptionTier: user.subscriptionTier
        },
        isPro: user.isPro
      }
    });
  })
);

authRouter.post(
  "/refresh",
  attachUserFromCookie,
  validateBody(refreshSchema),
  requireUser,
  asyncHandler(async (req, res) => {
    const user = await getUserWithProfile(req.user!.userId);
    const token = signAuthToken({ userId: user.id, email: user.email });
    setAuthCookie(res, token);
    return res.status(200).json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          isPro: user.isPro,
          subscriptionTier: user.subscriptionTier
        },
        isPro: user.isPro
      }
    });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME);
    return res.status(200).json({ data: { ok: true } });
  })
);

authRouter.get(
  "/me",
  attachUserFromCookie,
  requireUser,
  asyncHandler(async (req, res) => {
    const user = await getUserWithProfile(req.user!.userId);
    return res.status(200).json({ data: mapProfileResponse(user) });
  })
);
