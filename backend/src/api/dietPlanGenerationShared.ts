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
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  enum?: Array<string | number | boolean | null>;
  anyOf?: JsonSchema[];
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
  validatePlan?: (dietPlan: DietPlan) => void;
}

type DietEntryKind = "recipe-meal" | "single-food-meal" | "supplement";
type DietMealSlot = "breakfast" | "snack1" | "lunch" | "dinner" | "snack2";
type DietConsumableSlot = DietMealSlot | "supplements";

const dietMealSlots: DietMealSlot[] = [
  "breakfast",
  "snack1",
  "lunch",
  "dinner",
  "snack2",
];

const dietMealSlotLabels: Record<DietMealSlot, string> = {
  breakfast: "Breakfast",
  snack1: "Snack 1",
  lunch: "Lunch",
  dinner: "Dinner",
  snack2: "Snack 2",
};

const dietConsumableSlotLabels: Record<DietConsumableSlot, string> = {
  ...dietMealSlotLabels,
  supplements: "Supplements",
};

const normalizeMealCount = (numberOfMeals: number): number => (
  Number.isFinite(numberOfMeals)
    ? Math.max(1, Math.min(6, Math.round(numberOfMeals)))
    : 3
);

export const createEmptyDietEntry = (): DietPlanEntry => ({
  object: "",
  description: "",
  quantity: 0,
  quantityUnit: "",
  ingredients: [],
  macros: {
    protein: "0g",
    carbs: "0g",
    fats: "0g",
  },
  calories: 0,
  kilojoules: 0,
});

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

const emptyMacroSchema: JsonSchema = {
  type: "object",
  properties: {
    protein: { type: "string", enum: ["0g"] },
    carbs: { type: "string", enum: ["0g"] },
    fats: { type: "string", enum: ["0g"] },
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

const emptyMealSchema: JsonSchema = {
  type: "object",
  properties: {
    object: { type: "string", enum: [""] },
    description: { type: "string", enum: [""] },
    quantity: { type: "number", enum: [0] },
    quantityUnit: { type: "string", enum: [""] },
    ingredients: {
      type: "array",
      items: ingredientSchema,
      maxItems: 0,
    },
    macros: emptyMacroSchema,
    calories: { type: "number", enum: [0] },
    kilojoules: { type: "number", enum: [0] },
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
    ? { anyOf: [recipeMealSchema, emptyMealSchema] }
    : { anyOf: [singleFoodMealSchema, emptyMealSchema] };

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

export const resolveActiveDietMealSlots = (
  numberOfMeals: number,
): DietMealSlot[] => {
  const normalizedMealCount = normalizeMealCount(numberOfMeals);

  switch (normalizedMealCount) {
    case 1:
      return ["lunch"];
    case 2:
      return ["lunch", "dinner"];
    case 3:
      return ["breakfast", "lunch", "dinner"];
    case 4:
      return ["breakfast", "snack1", "lunch", "dinner"];
    default:
      return [...dietMealSlots];
  }
};

export const requiresSupplementSlotForMealCount = (
  numberOfMeals: number,
): boolean => normalizeMealCount(numberOfMeals) === 6;

const resolveActiveDietConsumableSlots = (
  numberOfMeals: number,
): DietConsumableSlot[] => {
  const activeSlots = resolveActiveDietMealSlots(numberOfMeals);
  return requiresSupplementSlotForMealCount(numberOfMeals)
    ? [...activeSlots, "supplements"]
    : activeSlots;
};

const resolveInactiveDietMealSlots = (numberOfMeals: number): DietMealSlot[] => {
  const activeSlots = new Set(resolveActiveDietMealSlots(numberOfMeals));
  return dietMealSlots.filter((slot) => !activeSlots.has(slot));
};

export const isEmptyDietEntry = (entry: DietPlanEntry): boolean => (
  entry.object.trim().length === 0
  && entry.description.trim().length === 0
  && entry.quantity === 0
  && entry.ingredients.length === 0
  && entry.calories === 0
  && entry.kilojoules === 0
  && entry.macros.protein === "0g"
  && entry.macros.carbs === "0g"
  && entry.macros.fats === "0g"
);

export const buildMealCountPromptGuidance = (numberOfMeals: number): string => {
  const normalizedMealCount = normalizeMealCount(numberOfMeals);
  const activeMealLabels = resolveActiveDietMealSlots(numberOfMeals)
    .map((slot) => dietMealSlotLabels[slot])
    .join(", ");
  const activeConsumableLabels = resolveActiveDietConsumableSlots(numberOfMeals)
    .map((slot) => dietConsumableSlotLabels[slot])
    .join(", ");
  const inactiveMealLabels = resolveInactiveDietMealSlots(numberOfMeals)
    .map((slot) => dietMealSlotLabels[slot]);

  if (requiresSupplementSlotForMealCount(numberOfMeals)) {
    return `- The user requested ${normalizedMealCount} meals per day.
- Use all standard meal slots plus a populated supplements slot as the sixth intake: ${activeConsumableLabels}.
- Do not leave supplements empty when 6 meals are requested.`;
  }

  if (inactiveMealLabels.length === 0) {
    return `- The user requested ${normalizedMealCount} meals per day, so use all meal slots: ${activeMealLabels}.`;
  }

  return `- The user requested ${normalizedMealCount} meals per day.
- Only these meal slots may contain real meals: ${activeMealLabels}.
- For inactive meal slots (${inactiveMealLabels.join(", ")}), return this exact empty placeholder object: ${JSON.stringify(createEmptyDietEntry())}`;
};

export const ensureDietPlanMatchesMealCount = (
  dietPlan: DietPlan,
  numberOfMeals: number,
): void => {
  for (const day of dietPlan.days) {
    ensureDietPlanDayMatchesMealCount(day, numberOfMeals);
  }
};

export const ensureDietPlanDayMatchesMealCount = (
  day: DietPlanDay,
  numberOfMeals: number,
): void => {
  const activeSlots = resolveActiveDietMealSlots(numberOfMeals);
  const missingActiveSlots = activeSlots.filter((slot) => isEmptyDietEntry(day[slot]));

  if (missingActiveSlots.length > 0) {
    throw new Error(
      `Diet plan is missing required meals for slots: ${missingActiveSlots
        .map((slot) => dietMealSlotLabels[slot])
        .join(", ")}.`,
    );
  }

  if (requiresSupplementSlotForMealCount(numberOfMeals) && day.supplements.length === 0) {
    throw new Error("Diet plan is missing required meals for slots: Supplements.");
  }
};

export const applyMealCountToDietPlan = (
  dietPlan: DietPlan,
  numberOfMeals: number,
): DietPlan => ({
  ...dietPlan,
  days: dietPlan.days.map((day) => applyMealCountToDietPlanDay(day, numberOfMeals)),
});

export const applyMealCountToDietPlanDay = (
  day: DietPlanDay,
  numberOfMeals: number,
): DietPlanDay => {
  const activeSlots = new Set(resolveActiveDietMealSlots(numberOfMeals));

  return {
    ...day,
    breakfast: activeSlots.has("breakfast") ? day.breakfast : createEmptyDietEntry(),
    snack1: activeSlots.has("snack1") ? day.snack1 : createEmptyDietEntry(),
    lunch: activeSlots.has("lunch") ? day.lunch : createEmptyDietEntry(),
    dinner: activeSlots.has("dinner") ? day.dinner : createEmptyDietEntry(),
    snack2: activeSlots.has("snack2") ? day.snack2 : createEmptyDietEntry(),
  };
};

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
      dependencies.validatePlan?.(dietPlan);

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
    ? "SIMPLE MEALS FROM SINGLE FOODS - Each active meal slot must contain a full meal made from plain foods with exact quantities, short description, macros, calories, and kilojoules, but not recipe-style preparation. Inactive meal slots must stay empty."
    : `RECIPE-BASED - Each active meal slot must contain one recipe object with total quantity, quantityUnit (prefer g or ml), an ingredients array with exact per-ingredient quantities, a concise description, cuisine influence (${cuisineOptions}), clear preparation instructions, preparationTimeMinutes, macros, calories, and kilojoules. Inactive meal slots must stay empty.`;
  const targetWeightDelta = Math.round((userData.targetWeight - userData.weight) * 10) / 10;
  const progressDirection = targetWeightDelta < -0.2
    ? `The client is progressing from ${userData.weight}kg toward ${userData.targetWeight}kg. Make the 7-day diet progressive for gradual fat loss or recomposition: keep protein high, improve satiety, and tighten energy density across the week without extreme restriction.`
    : targetWeightDelta > 0.2
      ? `The client is progressing from ${userData.weight}kg toward ${userData.targetWeight}kg. Make the 7-day diet progressive for gradual mass gain or recovery support: keep meals structured, support training output, and add energy mostly through carbs and useful fats without turning the plan into junk food.`
      : `The client is already near the target weight at ${userData.targetWeight}kg. Keep the 7-day diet progressive through variety, consistency, and recovery support while holding intake close to the daily targets.`;
  const cheatMealGuidance = userData.cheatWeeklyMeal
    ? "Allow exactly one weekly cheat or flex meal inside the 7-day plan. Keep it realistic, controlled, and still close to the daily calories and macro targets."
    : "Do not include cheat meals, flex meals, or free meals anywhere in the 7-day plan.";

  return {
    targetCalories: userData.caloriesTarget,
    targetKilojoules: userData.kilojoulesTarget,
    proteinTarget: userData.proteinTarget,
    carbsTarget: userData.carbsTarget,
    fatsTarget: userData.fatsTarget,
    cuisineOptions,
    mealStructure,
    progressDirection,
    cheatMealGuidance,
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

  if (entryKind !== "supplement" && isEmptyDietEntry(candidate as DietPlanEntry)) {
    return candidate.instructions === undefined
      && candidate.preparationTimeMinutes === undefined;
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
