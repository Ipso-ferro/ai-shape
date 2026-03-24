import { createOpenAIClient, DIET_PLAN_MAX_TOKENS, MODEL } from "./client";
import {
  ApiResponse,
  DataUserCommand,
  DietContext,
  DietPlan,
  DietPlanEntry,
  DietPlanDay,
  DietType,
} from "../types";

export type JsonSchema = {
  type: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
};

export interface DietGenerationAttempt {
  label: string;
  prompt: string;
  temperature: number;
}

interface DietGenerationDependencies {
  client?: {
    chat: {
      completions: {
        create: (request: {
          model: string;
          messages: Array<{ role: "system" | "user"; content: string }>;
          temperature: number;
          max_tokens: number;
          response_format: {
            type: "json_schema";
            json_schema: {
              name: string;
              strict: true;
              schema: JsonSchema;
            };
          };
        }) => Promise<{
          choices: Array<{
            finish_reason?: string | null;
            message?: {
              content?: string | null;
              refusal?: string | null;
            };
          }>;
        }>;
      };
    };
  };
  systemPrompt: string;
}

type DietEntryKind = "recipe-meal" | "single-food-meal" | "supplement";

const macroSchema: JsonSchema = {
  type: "object",
  properties: {
    protein: { type: "string" },
    carbs: { type: "string" },
    fats: { type: "string" },
  },
  required: ["protein", "carbs", "fats"],
  additionalProperties: false,
};

const ingredientSchema: JsonSchema = {
  type: "object",
  properties: {
    item: { type: "string" },
    quantity: { type: "number" },
    quantityUnit: { type: "string" },
  },
  required: ["item", "quantity", "quantityUnit"],
  additionalProperties: false,
};

const supplementSchema: JsonSchema = {
  type: "object",
  properties: {
    object: { type: "string" },
    description: { type: "string" },
    quantity: { type: "number" },
    quantityUnit: { type: "string" },
    ingredients: {
      type: "array",
      items: ingredientSchema,
    },
    macros: macroSchema,
    calories: { type: "number" },
    kilojoules: { type: "number" },
  },
  required: [
    "object",
    "description",
    "quantity",
    "quantityUnit",
    "ingredients",
    "macros",
    "calories",
    "kilojoules",
  ],
  additionalProperties: false,
};

const singleFoodMealSchema: JsonSchema = {
  ...supplementSchema,
};

const recipeMealSchema: JsonSchema = {
  type: "object",
  properties: {
    object: { type: "string" },
    description: { type: "string" },
    quantity: { type: "number" },
    quantityUnit: { type: "string" },
    ingredients: {
      type: "array",
      items: ingredientSchema,
      minItems: 3,
    },
    instructions: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 5,
    },
    preparationTimeMinutes: {
      type: "number",
      minimum: 1,
    },
    macros: macroSchema,
    calories: { type: "number" },
    kilojoules: { type: "number" },
  },
  required: [
    "object",
    "description",
    "quantity",
    "quantityUnit",
    "ingredients",
    "instructions",
    "preparationTimeMinutes",
    "macros",
    "calories",
    "kilojoules",
  ],
  additionalProperties: false,
};

const buildDaySchema = (dietType: DietType): JsonSchema => {
  const mealSchema = dietType === "recipes"
    ? recipeMealSchema
    : singleFoodMealSchema;

  return {
    type: "object",
    properties: {
      day: { type: "number" },
      dayName: { type: "string" },
      breakfast: mealSchema,
      snack1: mealSchema,
      lunch: mealSchema,
      dinner: mealSchema,
      snack2: mealSchema,
      supplements: {
        type: "array",
        items: supplementSchema,
      },
    },
    required: [
      "day",
      "dayName",
      "breakfast",
      "snack1",
      "lunch",
      "dinner",
      "snack2",
      "supplements",
    ],
    additionalProperties: false,
  };
};

export const buildDietPlanDaySchema = (dietType: DietType): JsonSchema => (
  buildDaySchema(dietType)
);

const buildDietPlanResponseSchema = (dietType: DietType): JsonSchema => ({
  type: "object",
  properties: {
    dietPlan: {
      type: "object",
      properties: {
        summary: {
          type: "object",
          properties: {
            dailyCalories: { type: "number" },
            macros: macroSchema,
            cuisines: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["dailyCalories", "macros", "cuisines"],
          additionalProperties: false,
        },
        days: {
          type: "array",
          items: buildDaySchema(dietType),
          minItems: 7,
          maxItems: 7,
        },
      },
      required: ["summary", "days"],
      additionalProperties: false,
    },
  },
  required: ["dietPlan"],
  additionalProperties: false,
});

const buildResponseFormat = (dietType: DietType): {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: true;
    schema: JsonSchema;
  };
} => ({
  type: "json_schema",
  json_schema: {
    name: dietType === "recipes" ? "recipe_diet_plan_response" : "single_food_diet_plan_response",
    strict: true,
    schema: buildDietPlanResponseSchema(dietType),
  },
});

const buildGenerationMetadata = (
  userData: DataUserCommand,
  dietType: DietType,
  attemptLabel: string,
): ApiResponse<DietPlan>["metadata"] => ({
  userId: userData.id,
  dietType,
  attempt: attemptLabel,
  generatedAt: new Date().toISOString(),
});

const extractJsonPayload = (content: string): string => {
  const trimmedContent = content.trim();
  const fencedMatch = trimmedContent.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const firstBraceIndex = trimmedContent.indexOf("{");
  const lastBraceIndex = trimmedContent.lastIndexOf("}");

  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return trimmedContent.slice(firstBraceIndex, lastBraceIndex + 1);
  }

  return trimmedContent;
};

const parseResponseContent = (content: string): { dietPlan?: DietPlan } => {
  return JSON.parse(extractJsonPayload(content)) as { dietPlan?: DietPlan };
};

const createAttemptError = (
  attemptLabel: string,
  error: unknown,
): Error => {
  const message = error instanceof Error ? error.message : "Unknown error";
  return new Error(`[${attemptLabel}] ${message}`);
};

const isValidIngredient = (ingredient: unknown): boolean => {
  if (typeof ingredient !== "object" || ingredient === null) {
    return false;
  }

  const candidate = ingredient as {
    item?: unknown;
    quantity?: unknown;
    quantityUnit?: unknown;
  };

  return typeof candidate.item === "string"
    && typeof candidate.quantity === "number"
    && typeof candidate.quantityUnit === "string";
};

const hasValidMacros = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    protein?: unknown;
    carbs?: unknown;
    fats?: unknown;
  };

  return typeof candidate.protein === "string"
    && typeof candidate.carbs === "string"
    && typeof candidate.fats === "string";
};

export async function executeDietPlanGeneration(
  userData: DataUserCommand,
  dietType: DietType,
  attempts: DietGenerationAttempt[],
  dependencies: DietGenerationDependencies,
): Promise<ApiResponse<DietPlan>> {
  const client = dependencies.client ?? createOpenAIClient();
  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: dependencies.systemPrompt },
          { role: "user", content: attempt.prompt },
        ],
        temperature: attempt.temperature,
        max_tokens: DIET_PLAN_MAX_TOKENS,
        response_format: buildResponseFormat(dietType),
      });

      const choice = completion.choices[0];
      const responseContent = choice?.message?.content;
      const refusal = choice?.message?.refusal;

      if (refusal) {
        throw new Error(`Model refused the request: ${refusal}`);
      }

      if (!responseContent) {
        throw new Error("Empty response from API");
      }

      if (choice?.finish_reason === "length") {
        throw new Error("Incomplete JSON response from API (output was truncated).");
      }

      const response = parseResponseContent(responseContent);
      const dietPlan = validateDietPlanResponse(response, dietType);

      return {
        success: true,
        data: dietPlan,
        metadata: buildGenerationMetadata(userData, dietType, attempt.label),
      };
    } catch (error) {
      errors.push(createAttemptError(attempt.label, error).message);
    }
  }

  const finalMessage = errors.join(" | ");
  console.error("Diet Plan Generation Error:", finalMessage);
  throw new Error(`Failed to generate diet plan: ${finalMessage || "Unknown error"}`);
}

export function calculateDietContext(
  userData: DataUserCommand,
  dietType: DietType,
): DietContext {
  const cuisineOptions = userData.favorieteCoucineRecipes?.length > 0
    ? userData.favorieteCoucineRecipes.join(", ")
    : "International variety";

  const mealStructure = dietType === "single-food"
    ? "SIMPLE MEALS FROM SINGLE FOODS - Each meal slot must contain a full meal made from plain foods with exact quantities, short description, macros, calories, and kilojoules, but not recipe-style preparation."
    : `RECIPE-BASED - Each meal slot must contain one recipe object with total quantity, quantityUnit (prefer g or ml), an ingredients array with exact per-ingredient quantities, a concise description, cuisine influence (${cuisineOptions}), clear preparation instructions, preparationTimeMinutes, macros, calories, and kilojoules.`;

  return {
    targetCalories: userData.caloriesTarget,
    targetKilojoules: userData.kilojoulesTarget,
    proteinTarget: userData.proteinTarget,
    carbsTarget: userData.carbsTarget,
    fatsTarget: userData.fatsTarget,
    cuisineOptions,
    mealStructure,
  };
}

export function buildDietPlanSummary(userData: DataUserCommand): DietPlan["summary"] {
  return {
    dailyCalories: Math.round(userData.caloriesTarget),
    macros: {
      protein: `${Math.round(userData.proteinTarget)}g`,
      carbs: `${Math.round(userData.carbsTarget)}g`,
      fats: `${Math.round(userData.fatsTarget)}g`,
    },
    cuisines: userData.favorieteCoucineRecipes.length > 0
      ? userData.favorieteCoucineRecipes
      : ["international"],
  };
}

export function validateDietPlanResponse(
  response: { dietPlan?: DietPlan },
  dietType: DietType,
): DietPlan {
  if (
    !response.dietPlan
    || !Array.isArray(response.dietPlan.days)
    || response.dietPlan.days.length !== 7
    || response.dietPlan.days.some((day) => (
      !isValidDietEntry(day.breakfast, dietType === "recipes" ? "recipe-meal" : "single-food-meal")
      || !isValidDietEntry(day.snack1, dietType === "recipes" ? "recipe-meal" : "single-food-meal")
      || !isValidDietEntry(day.lunch, dietType === "recipes" ? "recipe-meal" : "single-food-meal")
      || !isValidDietEntry(day.dinner, dietType === "recipes" ? "recipe-meal" : "single-food-meal")
      || !isValidDietEntry(day.snack2, dietType === "recipes" ? "recipe-meal" : "single-food-meal")
      || !Array.isArray(day.supplements)
      || day.supplements.some((entry) => !isValidDietEntry(entry, "supplement"))
    ))
  ) {
    throw new Error("Invalid diet plan structure received from API");
  }

  return response.dietPlan;
}

export function validateDietPlanDay(
  value: unknown,
  dietType: DietType,
): DietPlanDay {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid diet plan day structure received from API");
  }

  const candidate = value as {
    day?: unknown;
    dayName?: unknown;
    breakfast?: unknown;
    snack1?: unknown;
    lunch?: unknown;
    dinner?: unknown;
    snack2?: unknown;
    supplements?: unknown;
  };

  if (
    typeof candidate.day !== "number"
    || typeof candidate.dayName !== "string"
    || !isValidDietEntry(candidate.breakfast, dietType === "recipes" ? "recipe-meal" : "single-food-meal")
    || !isValidDietEntry(candidate.snack1, dietType === "recipes" ? "recipe-meal" : "single-food-meal")
    || !isValidDietEntry(candidate.lunch, dietType === "recipes" ? "recipe-meal" : "single-food-meal")
    || !isValidDietEntry(candidate.dinner, dietType === "recipes" ? "recipe-meal" : "single-food-meal")
    || !isValidDietEntry(candidate.snack2, dietType === "recipes" ? "recipe-meal" : "single-food-meal")
    || !Array.isArray(candidate.supplements)
    || candidate.supplements.some((entry) => !isValidDietEntry(entry, "supplement"))
  ) {
    throw new Error("Invalid diet plan day structure received from API");
  }

  return candidate as DietPlanDay;
}

function isValidDietEntry(
  entry: unknown,
  entryKind: DietEntryKind,
): entry is DietPlanEntry {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as {
    object?: unknown;
    description?: unknown;
    quantity?: unknown;
    quantityUnit?: unknown;
    ingredients?: Array<unknown>;
    instructions?: unknown;
    preparationTimeMinutes?: unknown;
    macros?: unknown;
    calories?: unknown;
    kilojoules?: unknown;
  };

  const hasBaseShape = typeof candidate.object === "string"
    && typeof candidate.description === "string"
    && typeof candidate.quantity === "number"
    && typeof candidate.quantityUnit === "string"
    && Array.isArray(candidate.ingredients)
    && candidate.ingredients.every(isValidIngredient)
    && hasValidMacros(candidate.macros)
    && typeof candidate.calories === "number"
    && typeof candidate.kilojoules === "number";

  if (!hasBaseShape) {
    return false;
  }

  if (entryKind === "supplement") {
    return candidate.instructions === undefined
      && candidate.preparationTimeMinutes === undefined;
  }

  if (entryKind === "single-food-meal") {
    return candidate.instructions === undefined
      && candidate.preparationTimeMinutes === undefined;
  }

  const normalizedCandidate = candidate as {
    object: string;
    ingredients: Array<{
      item: string;
      quantity: number;
      quantityUnit: string;
    }>;
    instructions?: unknown;
    preparationTimeMinutes?: unknown;
  };
  const ingredients = normalizedCandidate.ingredients;
  const recipeName = normalizedCandidate.object.trim().toLowerCase();
  const ingredientNames = ingredients
    .map((ingredient) => ingredient.item.trim().toLowerCase())
    .filter((name) => name.length > 0);
  const matchesIngredientExactly = ingredientNames.includes(recipeName);

  return ingredients.length >= 3
    && recipeName.split(/\s+/).length >= 2
    && !matchesIngredientExactly
    && Array.isArray(normalizedCandidate.instructions)
    && normalizedCandidate.instructions.length >= 2
    && normalizedCandidate.instructions.every((instruction) => typeof instruction === "string")
    && typeof normalizedCandidate.preparationTimeMinutes === "number"
    && normalizedCandidate.preparationTimeMinutes > 0;
}
