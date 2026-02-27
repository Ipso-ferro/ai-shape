import type { UserProfile } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type ProfileLike = Pick<
  UserProfile,
  "ageYrs" | "heightCm" | "weightKg" | "targetWeightKg" | "activityLevel" | "mealsPerDay"
> & {
  goals: string[];
  diets: string[];
  allergies: string[];
};

type ProfileChanges = Array<{ field: string; from: unknown; to: unknown }>;

function parseActivityLevel(message: string): string | null {
  const normalized = message.toLowerCase();
  if (normalized.includes("sedentary")) return "SEDENTARY";
  if (normalized.includes("lightly active") || normalized.includes("light active")) return "LIGHTLY_ACTIVE";
  if (normalized.includes("moderately active") || normalized.includes("moderate")) return "MODERATELY_ACTIVE";
  if (normalized.includes("very active")) return "VERY_ACTIVE";
  if (normalized.includes("athlete")) return "ATHLETE";
  return null;
}

function parseGoal(message: string): string | null {
  const normalized = message.toLowerCase();
  if (normalized.includes("lose weight") || normalized.includes("fat loss")) return "Lose Weight";
  if (normalized.includes("build muscle") || normalized.includes("muscle")) return "Build Muscle";
  if (normalized.includes("maintain")) return "Maintain";
  if (normalized.includes("athletic")) return "Athletic Performance";
  if (normalized.includes("health")) return "Improve Health";
  return null;
}

function parseNumber(message: string, pattern: RegExp): number | null {
  const matched = message.match(pattern);
  if (!matched?.[1]) {
    return null;
  }
  const value = Number(matched[1]);
  return Number.isFinite(value) ? value : null;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export async function applyMessageDrivenProfileUpdates(
  userId: string,
  rawProfile: UserProfile,
  message: string
): Promise<{ profile: ProfileLike; changes: ProfileChanges }> {
  const profile: ProfileLike = {
    ageYrs: rawProfile.ageYrs,
    heightCm: rawProfile.heightCm,
    weightKg: rawProfile.weightKg,
    targetWeightKg: rawProfile.targetWeightKg,
    activityLevel: rawProfile.activityLevel,
    mealsPerDay: rawProfile.mealsPerDay,
    goals: Array.isArray(rawProfile.goals) ? (rawProfile.goals as string[]) : [],
    diets: Array.isArray(rawProfile.diets) ? (rawProfile.diets as string[]) : [],
    allergies: Array.isArray(rawProfile.allergies) ? (rawProfile.allergies as string[]) : []
  };

  const changes: ProfileChanges = [];

  const weight = parseNumber(message, /(?:my\s+)?weight\s*(?:to|is|at)?\s*(\d+(?:\.\d+)?)/i);
  if (weight && weight >= 25 && weight <= 250 && profile.weightKg !== weight) {
    changes.push({ field: "weightKg", from: profile.weightKg, to: weight });
    profile.weightKg = weight;
  }

  const targetWeight = parseNumber(message, /target\s+weight\s*(?:to|is|at)?\s*(\d+(?:\.\d+)?)/i);
  if (targetWeight && targetWeight >= 25 && targetWeight <= 250 && profile.targetWeightKg !== targetWeight) {
    changes.push({ field: "targetWeightKg", from: profile.targetWeightKg, to: targetWeight });
    profile.targetWeightKg = targetWeight;
  }

  const height = parseNumber(message, /height\s*(?:to|is|at)?\s*(\d+(?:\.\d+)?)/i);
  if (height && height >= 120 && height <= 230 && profile.heightCm !== height) {
    changes.push({ field: "heightCm", from: profile.heightCm, to: height });
    profile.heightCm = height;
  }

  const age = parseNumber(message, /(?:my\s+)?age\s*(?:to|is|at)?\s*(\d{1,3})/i);
  if (age && age >= 15 && age <= 120 && profile.ageYrs !== age) {
    changes.push({ field: "ageYrs", from: profile.ageYrs, to: age });
    profile.ageYrs = age;
  }

  const mealsPerDay = parseNumber(message, /(\d)\s+meals?\s+(?:a|per)\s+day/i);
  if (mealsPerDay && mealsPerDay >= 1 && mealsPerDay <= 6 && profile.mealsPerDay !== mealsPerDay) {
    changes.push({ field: "mealsPerDay", from: profile.mealsPerDay, to: mealsPerDay });
    profile.mealsPerDay = mealsPerDay;
  }

  const activityLevel = parseActivityLevel(message);
  if (activityLevel && profile.activityLevel !== activityLevel) {
    changes.push({ field: "activityLevel", from: profile.activityLevel, to: activityLevel });
    profile.activityLevel = activityLevel;
  }

  const goal = parseGoal(message);
  if (goal && !profile.goals.includes(goal)) {
    changes.push({ field: "goals", from: profile.goals, to: [goal] });
    profile.goals = [goal];
  }

  const addAllergyMatch = message.match(/(?:allergic to|add allergy)\s+([a-zA-Z\s]+)/i);
  if (addAllergyMatch?.[1]) {
    const allergy = addAllergyMatch[1].trim().replace(/\.$/, "");
    if (allergy && !profile.allergies.includes(allergy)) {
      profile.allergies = dedupe([...profile.allergies, allergy]);
      changes.push({ field: "allergies", from: rawProfile.allergies, to: profile.allergies });
    }
  }

  const removeAllergyMatch = message.match(/(?:remove allergy|not allergic to)\s+([a-zA-Z\s]+)/i);
  if (removeAllergyMatch?.[1]) {
    const allergy = removeAllergyMatch[1].trim().replace(/\.$/, "");
    const filtered = profile.allergies.filter((value) => value.toLowerCase() !== allergy.toLowerCase());
    if (filtered.length !== profile.allergies.length) {
      changes.push({ field: "allergies", from: profile.allergies, to: filtered });
      profile.allergies = filtered;
    }
  }

  if (changes.length > 0) {
    await prisma.userProfile.update({
      where: { userId },
      data: {
        ageYrs: profile.ageYrs,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        targetWeightKg: profile.targetWeightKg,
        activityLevel: profile.activityLevel,
        mealsPerDay: profile.mealsPerDay,
        goals: profile.goals,
        diets: profile.diets,
        allergies: profile.allergies
      }
    });
  }

  return { profile, changes };
}
