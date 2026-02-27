import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { addDays, getWeekdayLabel, toDateOnly, WEEK_DAYS } from "../utils/dates.js";
import { applyMessageDrivenProfileUpdates } from "./mcp-profile.service.js";
import { generateJsonFromAi } from "./openai.service.js";
import {
  getExerciseCandidates,
  getRecipeCandidates,
  getSimpleFoodCandidates,
  getSimpleFoodsByIds,
  type ExerciseRow,
  type RecipeRow,
  type SimpleFoodRow
} from "./source-data.service.js";
import type { UserWithProfile } from "./user.service.js";

type DietChatInput = {
  user: UserWithProfile;
  message: string;
};

type WorkoutChatInput = {
  user: UserWithProfile;
  message: string;
};

type DietAiMeal = {
  meal_type: string;
  recipe_id: number;
  simple_food_ids: number[];
  notes: string;
};

type DietAiDay = {
  weekday: string;
  meals: DietAiMeal[];
};

type DietAiPlan = {
  action: "create" | "modify";
  summary: string;
  daily_calorie_target: number;
  macro_guidance: string;
  weekly_plan: DietAiDay[];
  cautions: string[];
};

type WorkoutAiExercise = {
  exercise_id: number;
  sets: string;
  notes: string;
};

type WorkoutAiDay = {
  weekday: string;
  name: string;
  duration_min: number;
  intensity: string;
  exercises: WorkoutAiExercise[];
};

type WorkoutAiPlan = {
  action: "create" | "modify";
  summary: string;
  weekly_plan: WorkoutAiDay[];
  recovery_notes: string;
  cautions: string[];
};

const DIET_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: { type: "string", enum: ["create", "modify"] },
    summary: { type: "string" },
    daily_calorie_target: { type: "number" },
    macro_guidance: { type: "string" },
    weekly_plan: {
      type: "array",
      minItems: 1,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          weekday: { type: "string" },
          meals: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                meal_type: { type: "string" },
                recipe_id: { type: "integer" },
                simple_food_ids: {
                  type: "array",
                  items: { type: "integer" }
                },
                notes: { type: "string" }
              },
              required: ["meal_type", "recipe_id", "simple_food_ids", "notes"]
            }
          }
        },
        required: ["weekday", "meals"]
      }
    },
    cautions: { type: "array", items: { type: "string" } }
  },
  required: [
    "action",
    "summary",
    "daily_calorie_target",
    "macro_guidance",
    "weekly_plan",
    "cautions"
  ]
};

const WORKOUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: { type: "string", enum: ["create", "modify"] },
    summary: { type: "string" },
    weekly_plan: {
      type: "array",
      minItems: 1,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          weekday: { type: "string" },
          name: { type: "string" },
          duration_min: { type: "integer" },
          intensity: { type: "string" },
          exercises: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                exercise_id: { type: "integer" },
                sets: { type: "string" },
                notes: { type: "string" }
              },
              required: ["exercise_id", "sets", "notes"]
            }
          }
        },
        required: ["weekday", "name", "duration_min", "intensity", "exercises"]
      }
    },
    recovery_notes: { type: "string" },
    cautions: { type: "array", items: { type: "string" } }
  },
  required: ["action", "summary", "weekly_plan", "recovery_notes", "cautions"]
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseMacroRatio(value: string): { proteinPct: number; carbsPct: number; fatPct: number } {
  const parts = value
    .split("/")
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));
  if (parts.length < 3) {
    return { proteinPct: 30, carbsPct: 40, fatPct: 30 };
  }
  return {
    proteinPct: parts[0],
    carbsPct: parts[1],
    fatPct: parts[2]
  };
}

function parseRecipeIngredients(recipe: RecipeRow): Array<{ ingredient_id: number; amount_grams: number }> {
  const value = recipe.ingredients_list;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const ingredientId = Number((item as { ingredient_id?: unknown }).ingredient_id);
        const amountGrams = Number((item as { amount_grams?: unknown }).amount_grams);
        if (!Number.isInteger(ingredientId) || !Number.isFinite(amountGrams)) return null;
        return { ingredient_id: ingredientId, amount_grams: amountGrams };
      })
      .filter((item): item is { ingredient_id: number; amount_grams: number } => item !== null);
  }
  if (typeof value === "string") {
    try {
      return parseRecipeIngredients({
        ...recipe,
        ingredients_list: JSON.parse(value) as unknown
      });
    } catch {
      return [];
    }
  }
  return [];
}

function toMealType(raw: string): "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" {
  const normalized = raw.toLowerCase();
  if (normalized.includes("break")) return "BREAKFAST";
  if (normalized.includes("lunch")) return "LUNCH";
  if (normalized.includes("dinner")) return "DINNER";
  return "SNACK";
}

function normalizeWeekday(raw: string, fallbackIndex: number): string {
  const target = raw.trim().toLowerCase();
  const match = WEEK_DAYS.find((day) => day.toLowerCase() === target);
  return match || WEEK_DAYS[fallbackIndex % WEEK_DAYS.length];
}

function chooseFallbackId(availableIds: number[]): number {
  return availableIds[Math.floor(Math.random() * availableIds.length)];
}

function createDietSystemPrompt() {
  return `
You are an AI nutrition coach.
Use only the provided recipe IDs and simple food IDs.
Do not invent IDs.
Create or modify a 7-day plan.
Keep meals actionable and safe.
Output strictly valid JSON matching the schema.
  `.trim();
}

function createWorkoutSystemPrompt() {
  return `
You are an AI fitness coach.
Use only provided exercise IDs.
Do not invent IDs.
Create or modify a 7-day workout protocol.
Keep instructions practical and safe.
Output strictly valid JSON matching the schema.
  `.trim();
}

export async function generateDietPlanFromMessage(input: DietChatInput) {
  const { user, message } = input;
  const recipes = await getRecipeCandidates(100);
  const simpleFoods = await getSimpleFoodCandidates(200);
  const latestPlan = await prisma.dietPlan.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });

  const { profile: updatedProfile, changes } = await applyMessageDrivenProfileUpdates(
    user.id,
    user.profile,
    message
  );

  const promptPayload = {
    task: "Create or update 7-day diet plan",
    message,
    userProfile: {
      ageYrs: updatedProfile.ageYrs,
      heightCm: updatedProfile.heightCm,
      weightKg: updatedProfile.weightKg,
      targetWeightKg: updatedProfile.targetWeightKg,
      activityLevel: updatedProfile.activityLevel,
      goals: updatedProfile.goals,
      diets: updatedProfile.diets,
      allergies: updatedProfile.allergies,
      mealsPerDay: updatedProfile.mealsPerDay
    },
    latestPlan: latestPlan?.planJson ?? null,
    recipes: recipes.map((recipe) => ({
      id: recipe.id,
      plate_name: recipe.plate_name,
      meal_type: recipe.meal_type,
      goal_affinity: recipe.goal_affinity,
      total_calories: recipe.total_calories,
      difficulty: recipe.difficulty
    })),
    simple_foods: simpleFoods.map((food) => ({
      id: food.id,
      name: food.name,
      category: food.category,
      calories: food.calories,
      proteins: food.proteins,
      carbs: food.carbs,
      fats: food.fats,
      glycemic_index: food.glycemic_index,
      is_allergen: Boolean(food.is_allergen)
    }))
  };

  const aiPlan = await generateJsonFromAi<DietAiPlan>({
    systemPrompt: createDietSystemPrompt(),
    userPrompt: JSON.stringify(promptPayload, null, 2),
    schemaName: "diet_week_plan",
    schema: DIET_SCHEMA
  });

  const recipeById = new Map<number, RecipeRow>(recipes.map((recipe) => [recipe.id, recipe]));
  const recipeIds = recipes.map((recipe) => recipe.id);
  const simpleFoodById = new Map<number, SimpleFoodRow>(simpleFoods.map((food) => [food.id, food]));

  const normalizedWeekPlan = aiPlan.weekly_plan.slice(0, 7).map((day, dayIndex) => {
    const weekday = normalizeWeekday(day.weekday, dayIndex);
    const meals = day.meals.slice(0, Math.max(updatedProfile.mealsPerDay, 3)).map((meal) => {
      const recipeId = recipeById.has(meal.recipe_id) ? meal.recipe_id : chooseFallbackId(recipeIds);
      const recipe = recipeById.get(recipeId) ?? recipes[0];
      const recipeIngredients = parseRecipeIngredients(recipe);
      const autoSimpleIds = recipeIngredients.slice(0, 4).map((item) => item.ingredient_id);
      const simpleFoodIds = meal.simple_food_ids.length > 0 ? meal.simple_food_ids : autoSimpleIds;
      const validSimpleIds = simpleFoodIds.filter((id) => simpleFoodById.has(id));
      const macros = parseMacroRatio(recipe.macro_ratio);
      const calories = Number(recipe.total_calories || 0);
      const proteinG = Math.round((calories * (macros.proteinPct / 100)) / 4);
      const carbsG = Math.round((calories * (macros.carbsPct / 100)) / 4);
      const fatG = Math.round((calories * (macros.fatPct / 100)) / 9);
      const ingredientLines = recipeIngredients
        .map((item) => {
          const food = simpleFoodById.get(item.ingredient_id);
          if (!food) return null;
          return `${Math.round(item.amount_grams)}g ${food.name}`;
        })
        .filter((item): item is string => Boolean(item));

      const instructions =
        recipe.instructions?.split(".").map((step) => step.trim()).filter(Boolean).slice(0, 6) ??
        [];

      return {
        mealType: toMealType(meal.meal_type),
        recipeId,
        recipeName: recipe.plate_name,
        simpleFoodIds: validSimpleIds,
        notes: meal.notes,
        calories,
        proteinG,
        carbsG,
        fatG,
        ingredients: ingredientLines,
        instructions
      };
    });

    return { weekday, meals };
  });

  const planToStore = {
    ...aiPlan,
    weekly_plan: normalizedWeekPlan.map((day) => ({
      weekday: day.weekday,
      meals: day.meals.map((meal) => ({
        meal_type: meal.mealType,
        recipe_id: meal.recipeId,
        recipe_name: meal.recipeName,
        simple_food_ids: meal.simpleFoodIds,
        notes: meal.notes
      }))
    }))
  };

  const today = toDateOnly(new Date());

  await prisma.$transaction(async (tx) => {
    await tx.dietPlan.create({
      data: {
        userId: user.id,
        summary: aiPlan.summary,
        planJson: planToStore as Prisma.InputJsonValue,
        sourceMessage: message,
        mcpChanges: changes as Prisma.InputJsonValue
      }
    });

    await tx.aiMessage.create({
      data: {
        userId: user.id,
        planType: "diet",
        userMessage: message,
        aiResponseSummary: aiPlan.summary,
        mcpChanges: changes as Prisma.InputJsonValue
      }
    });

    await tx.mealLog.deleteMany({
      where: {
        userId: user.id,
        date: { gte: today }
      }
    });

    for (let dayIndex = 0; dayIndex < normalizedWeekPlan.length; dayIndex += 1) {
      const date = addDays(today, dayIndex);
      for (const meal of normalizedWeekPlan[dayIndex].meals) {
        await tx.mealLog.create({
          data: {
            userId: user.id,
            date,
            mealType: meal.mealType,
            name: meal.recipeName,
            recipeId: meal.recipeId,
            simpleFoodIds: meal.simpleFoodIds as Prisma.InputJsonValue,
            calories: meal.calories,
            proteinG: meal.proteinG,
            carbsG: meal.carbsG,
            fatG: meal.fatG,
            ingredients: meal.ingredients as Prisma.InputJsonValue,
            instructions: meal.instructions as Prisma.InputJsonValue,
            eaten: false
          }
        });
      }
    }
  });

  const referencedRecipeIds = [
    ...new Set(normalizedWeekPlan.flatMap((day) => day.meals.map((meal) => meal.recipeId)))
  ];
  const referencedFoodIds = [
    ...new Set(normalizedWeekPlan.flatMap((day) => day.meals.flatMap((meal) => meal.simpleFoodIds)))
  ];

  return {
    customerId: user.id,
    planType: "diet",
    mcpChanges: changes,
    plan: planToStore,
    references: {
      recipeIds: referencedRecipeIds,
      simpleFoodIds: referencedFoodIds
    }
  };
}

export async function generateWorkoutPlanFromMessage(input: WorkoutChatInput) {
  const { user, message } = input;
  const exercises = await getExerciseCandidates(180);
  const latestPlan = await prisma.workoutPlan.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });

  const { profile: updatedProfile, changes } = await applyMessageDrivenProfileUpdates(
    user.id,
    user.profile,
    message
  );

  const promptPayload = {
    task: "Create or update 7-day workout plan",
    message,
    userProfile: {
      ageYrs: updatedProfile.ageYrs,
      heightCm: updatedProfile.heightCm,
      weightKg: updatedProfile.weightKg,
      targetWeightKg: updatedProfile.targetWeightKg,
      activityLevel: updatedProfile.activityLevel,
      goals: updatedProfile.goals
    },
    latestPlan: latestPlan?.planJson ?? null,
    exercises: exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
      goal: exercise.goal,
      type: exercise.type,
      muscle_group: exercise.muscle_group,
      equipment: exercise.equipment,
      difficulty: exercise.difficulty
    }))
  };

  const aiPlan = await generateJsonFromAi<WorkoutAiPlan>({
    systemPrompt: createWorkoutSystemPrompt(),
    userPrompt: JSON.stringify(promptPayload, null, 2),
    schemaName: "workout_week_plan",
    schema: WORKOUT_SCHEMA
  });

  const exerciseMap = new Map<number, ExerciseRow>(exercises.map((exercise) => [exercise.id, exercise]));
  const exerciseIds = exercises.map((exercise) => exercise.id);

  const normalizedWeekPlan = aiPlan.weekly_plan.slice(0, 7).map((day, dayIndex) => {
    const weekday = normalizeWeekday(day.weekday, dayIndex);
    const exercisesForDay = day.exercises.slice(0, 8).map((exercise) => {
      const exerciseId = exerciseMap.has(exercise.exercise_id)
        ? exercise.exercise_id
        : chooseFallbackId(exerciseIds);
      const resolved = exerciseMap.get(exerciseId) ?? exercises[0];
      return {
        exerciseId,
        name: resolved.name,
        sets: exercise.sets,
        notes: exercise.notes
      };
    });

    return {
      weekday,
      name: day.name,
      durationMin: day.duration_min,
      intensity: day.intensity,
      exercises: exercisesForDay
    };
  });

  const planToStore = {
    ...aiPlan,
    weekly_plan: normalizedWeekPlan.map((day) => ({
      weekday: day.weekday,
      name: day.name,
      duration_min: day.durationMin,
      intensity: day.intensity,
      exercises: day.exercises.map((exercise) => ({
        exercise_id: exercise.exerciseId,
        name: exercise.name,
        sets: exercise.sets,
        notes: exercise.notes
      }))
    }))
  };

  const today = toDateOnly(new Date());

  await prisma.$transaction(async (tx) => {
    await tx.workoutPlan.create({
      data: {
        userId: user.id,
        summary: aiPlan.summary,
        planJson: planToStore as Prisma.InputJsonValue,
        sourceMessage: message,
        mcpChanges: changes as Prisma.InputJsonValue
      }
    });

    await tx.aiMessage.create({
      data: {
        userId: user.id,
        planType: "workout",
        userMessage: message,
        aiResponseSummary: aiPlan.summary,
        mcpChanges: changes as Prisma.InputJsonValue
      }
    });

    await tx.exerciseLog.deleteMany({
      where: {
        userId: user.id,
        date: { gte: today }
      }
    });

    for (let dayIndex = 0; dayIndex < normalizedWeekPlan.length; dayIndex += 1) {
      const date = addDays(today, dayIndex);
      const day = normalizedWeekPlan[dayIndex];
      for (const exercise of day.exercises) {
        await tx.exerciseLog.create({
          data: {
            userId: user.id,
            date,
            weekday: day.weekday,
            name: exercise.name,
            exerciseId: exercise.exerciseId,
            sets: exercise.sets,
            notes: exercise.notes,
            durationMin: day.durationMin,
            intensity: day.intensity,
            completed: false
          }
        });
      }
    }
  });

  const referencedExerciseIds = [
    ...new Set(normalizedWeekPlan.flatMap((day) => day.exercises.map((exercise) => exercise.exerciseId)))
  ];

  return {
    customerId: user.id,
    planType: "workout",
    mcpChanges: changes,
    plan: planToStore,
    references: {
      exerciseIds: referencedExerciseIds
    }
  };
}

export async function generateShoppingListFromUpcomingMeals(userId: string) {
  const today = toDateOnly(new Date());
  const end = addDays(today, 7);
  const meals = await prisma.mealLog.findMany({
    where: {
      userId,
      date: { gte: today, lt: end }
    },
    orderBy: { date: "asc" }
  });

  const simpleFoodIdSet = new Set<number>();
  const ingredientFallbackNames: string[] = [];

  for (const meal of meals) {
    if (Array.isArray(meal.simpleFoodIds)) {
      for (const value of meal.simpleFoodIds) {
        const id = Number(value);
        if (Number.isInteger(id)) simpleFoodIdSet.add(id);
      }
    }
    if (Array.isArray(meal.ingredients)) {
      for (const value of meal.ingredients) {
        if (typeof value === "string") ingredientFallbackNames.push(value);
      }
    }
  }

  const ids = [...simpleFoodIdSet];
  const foods = await getSimpleFoodsByIds(ids);
  const counts = new Map<string, { qty: number; category: string }>();

  for (const food of foods) {
    const current = counts.get(food.name) ?? { qty: 0, category: food.category || "General" };
    current.qty += 1;
    counts.set(food.name, current);
  }

  for (const name of ingredientFallbackNames) {
    if (counts.has(name)) continue;
    const current = counts.get(name) ?? { qty: 0, category: "General" };
    current.qty += 1;
    counts.set(name, current);
  }

  await prisma.shoppingItem.deleteMany({ where: { userId } });
  if (counts.size === 0) {
    return [];
  }

  const created: Array<{
    id: number;
    name: string;
    qty: string;
    category: string;
    checked: boolean;
  }> = [];

  for (const [name, info] of counts.entries()) {
    const item = await prisma.shoppingItem.create({
      data: {
        userId,
        name,
        qty: `${info.qty}x`,
        category: info.category,
        checked: false
      }
    });
    created.push({
      id: item.id,
      name: item.name,
      qty: item.qty,
      category: item.category,
      checked: item.checked
    });
  }

  return created;
}

export async function getCustomerAiPlans(userId: string) {
  const latestDietPlan = await prisma.dietPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });

  const latestWorkoutPlan = await prisma.workoutPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });

  const recentMessages = await prisma.aiMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return {
    customerId: userId,
    latestDietPlan,
    latestWorkoutPlan,
    recentMessages
  };
}
