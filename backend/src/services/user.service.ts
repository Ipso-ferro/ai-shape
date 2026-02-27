import bcrypt from "bcryptjs";
import { Prisma, type User, type UserProfile } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type RegisterInput = {
  email: string;
  password: string;
  gender: string;
  ageYrs: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  goals: string[];
  workoutLocations: string[];
  diets: string[];
  allergies: string[];
  activityLevel: string;
  mealsPerDay: number;
};

type MacroTargets = {
  proteinG: number;
  carbsG: number;
  fatG: number;
  dailyCalories: number;
};

export type UserWithProfile = User & { profile: UserProfile };

const activityMultipliers: Record<string, number> = {
  SEDENTARY: 1.2,
  LIGHTLY_ACTIVE: 1.375,
  MODERATELY_ACTIVE: 1.55,
  VERY_ACTIVE: 1.725,
  ATHLETE: 1.9
};

function normalizeGender(raw: string): "MALE" | "FEMALE" {
  const value = raw.toUpperCase();
  return value === "FEMALE" ? "FEMALE" : "MALE";
}

function calculateMacroTargets(input: {
  gender: string;
  ageYrs: number;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  goal: string;
}): MacroTargets {
  const gender = normalizeGender(input.gender);
  const bmrBase = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYrs;
  const bmr = gender === "MALE" ? bmrBase + 5 : bmrBase - 161;
  const multiplier = activityMultipliers[input.activityLevel] ?? activityMultipliers.MODERATELY_ACTIVE;
  let calories = bmr * multiplier;

  const goal = input.goal.toLowerCase();
  if (goal.includes("lose") || goal.includes("fat")) calories -= 350;
  if (goal.includes("build") || goal.includes("muscle")) calories += 250;
  calories = Math.max(1200, Math.round(calories));

  const protein = Math.round(input.weightKg * 2.0);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return {
    proteinG: Math.max(60, protein),
    carbsG: Math.max(80, carbs),
    fatG: Math.max(30, fat),
    dailyCalories: calories
  };
}

export async function registerUser(input: RegisterInput): Promise<User & { profile: UserProfile }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    const error = new Error("Email already in use") as Error & { statusCode?: number };
    error.statusCode = 409;
    throw error;
  }

  const goalForMacros = input.goals[0] || "Maintain";
  const macros = calculateMacroTargets({
    gender: input.gender,
    ageYrs: input.ageYrs,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    activityLevel: input.activityLevel,
    goal: goalForMacros
  });

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      passwordHash,
      profile: {
        create: {
          gender: normalizeGender(input.gender),
          ageYrs: input.ageYrs,
          heightCm: input.heightCm,
          weightKg: input.weightKg,
          targetWeightKg: input.targetWeightKg,
          goals: input.goals,
          workoutLocations: input.workoutLocations,
          diets: input.diets,
          allergies: input.allergies,
          activityLevel: input.activityLevel,
          mealsPerDay: input.mealsPerDay,
          macroVelocity: "AI_RECOMMENDED",
          proteinG: macros.proteinG,
          carbsG: macros.carbsG,
          fatG: macros.fatG
        }
      }
    },
    include: { profile: true }
  });

  return user as UserWithProfile;
}

export async function loginUser(email: string, password: string): Promise<User> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() }
  });
  if (!user) {
    const error = new Error("Invalid credentials") as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const error = new Error("Invalid credentials") as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }

  return user;
}

export async function getUserWithProfile(userId: string): Promise<UserWithProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true }
  });
  if (!user || !user.profile) {
    const error = new Error("Profile not found") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }
  return user as UserWithProfile;
}

export async function updateUserProfile(
  userId: string,
  payload: {
    diets?: string[];
    allergies?: string[];
    workoutLocations?: string[];
    goals?: string[];
    macroVelocity?: string;
    activityLevel?: string;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
  }
) {
  const user = await getUserWithProfile(userId);
  const current = user.profile;

  const updated = await prisma.userProfile.update({
    where: { userId },
    data: {
      diets: (payload.diets ?? current.diets) as Prisma.InputJsonValue,
      allergies: (payload.allergies ?? current.allergies) as Prisma.InputJsonValue,
      workoutLocations: (payload.workoutLocations ?? current.workoutLocations) as Prisma.InputJsonValue,
      goals: (payload.goals ?? current.goals) as Prisma.InputJsonValue,
      macroVelocity: payload.macroVelocity ?? current.macroVelocity,
      activityLevel: payload.activityLevel ?? current.activityLevel,
      proteinG: payload.proteinG ?? current.proteinG,
      carbsG: payload.carbsG ?? current.carbsG,
      fatG: payload.fatG ?? current.fatG
    }
  });

  return updated;
}

export function mapProfileResponse(user: UserWithProfile) {
  return {
    id: user.id,
    email: user.email,
    isPro: user.isPro,
    subscriptionTier: user.subscriptionTier,
    profile: {
      gender: user.profile.gender,
      ageYrs: user.profile.ageYrs,
      heightCm: user.profile.heightCm,
      weightKg: user.profile.weightKg,
      targetWeightKg: user.profile.targetWeightKg,
      goals: user.profile.goals,
      workoutLocations: user.profile.workoutLocations,
      diets: user.profile.diets,
      allergies: user.profile.allergies,
      activityLevel: user.profile.activityLevel,
      macroVelocity: user.profile.macroVelocity,
      macroTargets: {
        proteinG: user.profile.proteinG,
        carbsG: user.profile.carbsG,
        fatG: user.profile.fatG
      },
      dailyCalories:
        user.profile.proteinG * 4 + user.profile.carbsG * 4 + user.profile.fatG * 9
    }
  };
}
