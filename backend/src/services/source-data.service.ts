import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type RecipeRow = {
  id: number;
  plate_name: string;
  meal_type: string;
  goal_affinity: string;
  total_calories: number;
  macro_ratio: string;
  difficulty: string;
  ingredients_list: unknown;
  instructions: string | null;
};

export type SimpleFoodRow = {
  id: number;
  name: string;
  category: string;
  calories: number;
  proteins: number;
  carbs: number;
  fats: number;
  fiber: number;
  glycemic_index: string;
  is_allergen: number;
};

export type ExerciseRow = {
  id: number;
  name: string;
  category: string;
  goal: string;
  type: string;
  muscle_group: string;
  equipment: string;
  difficulty: string;
  description: string | null;
  tips: string | null;
  precautions: string | null;
};

export async function getRecipeCandidates(limit = 80): Promise<RecipeRow[]> {
  return prisma.$queryRaw<RecipeRow[]>(Prisma.sql`
    SELECT id, plate_name, meal_type, goal_affinity, total_calories, macro_ratio, difficulty, ingredients_list, instructions
    FROM recipes
    ORDER BY id DESC
    LIMIT ${limit}
  `);
}

export async function getSimpleFoodCandidates(limit = 120): Promise<SimpleFoodRow[]> {
  try {
    return await prisma.$queryRaw<SimpleFoodRow[]>(Prisma.sql`
      SELECT id, name, category, calories, proteins, carbs, fats, fiber, glycemic_index, is_allergen
      FROM simple_foods
      ORDER BY id DESC
      LIMIT ${limit}
    `);
  } catch {
    return prisma.$queryRaw<SimpleFoodRow[]>(Prisma.sql`
      SELECT id, name, category, calories, proteins, carbs, fats, fiber, glycemic_index, is_allergen
      FROM simple_fods
      ORDER BY id DESC
      LIMIT ${limit}
    `);
  }
}

export async function getSimpleFoodsByIds(ids: number[]): Promise<SimpleFoodRow[]> {
  if (ids.length === 0) {
    return [];
  }
  const placeholders = Prisma.join(ids);
  try {
    return await prisma.$queryRaw<SimpleFoodRow[]>(Prisma.sql`
      SELECT id, name, category, calories, proteins, carbs, fats, fiber, glycemic_index, is_allergen
      FROM simple_foods
      WHERE id IN (${placeholders})
    `);
  } catch {
    return prisma.$queryRaw<SimpleFoodRow[]>(Prisma.sql`
      SELECT id, name, category, calories, proteins, carbs, fats, fiber, glycemic_index, is_allergen
      FROM simple_fods
      WHERE id IN (${placeholders})
    `);
  }
}

export async function getExerciseCandidates(limit = 120): Promise<ExerciseRow[]> {
  return prisma.$queryRaw<ExerciseRow[]>(Prisma.sql`
    SELECT id, name, category, goal, type, muscle_group, equipment, difficulty, description, tips, precautions
    FROM exercises
    ORDER BY id DESC
    LIMIT ${limit}
  `);
}

export async function verifySourceTables(): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ TABLE_NAME?: string; table_name?: string }>>(Prisma.sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE LOWER(table_schema) = LOWER(DATABASE())
      AND table_name IN ('recipes', 'simple_foods', 'simple_fods', 'exercises')
  `);

  const names = new Set(
    rows
      .map((row) => row.table_name ?? row.TABLE_NAME)
      .filter((value): value is string => Boolean(value))
  );

  const missing: string[] = [];
  if (!names.has("recipes")) missing.push("recipes");
  if (!names.has("exercises")) missing.push("exercises");
  if (!names.has("simple_foods") && !names.has("simple_fods")) {
    missing.push("simple_foods (or simple_fods)");
  }

  if (missing.length > 0) {
    const error = new Error(`Missing required source tables: ${missing.join(", ")}`) as Error & {
      statusCode?: number;
    };
    error.statusCode = 500;
    throw error;
  }
}
