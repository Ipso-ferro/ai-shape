import {
  applyMealCountToDietPlan,
  applyMealCountToDietPlanDay,
  buildMealCountPromptGuidance,
  buildDietPlanDaySchema,
  buildDietPlanSummary,
  JsonSchema,
  executeDietPlanGeneration,
  calculateDietContext,
  ensureDietPlanDayMatchesMealCount,
  ensureDietPlanMatchesMealCount,
  requiresSupplementSlotForMealCount,
  validateDietPlanDay,
} from "./dietPlanGenerationShared";
import { createOpenAIClient, MODEL, DIET_PLAN_MAX_TOKENS } from "./client";
import { SkillLoader } from "../utils/skillLoader";
import {
  ApiResponse,
  DataUserCommand,
  DietPlan,
  DietPlanDay,
} from "../types";

const singleFoodDayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const missingSingleFoodSupplementError = "Required supplements were omitted from the single-food diet plan.";
const missingSixthMealSupplementError = "The sixth intake slot must be returned in supplements when 6 meals are requested.";

export async function generateSingleFoodPlan(
  userData: DataUserCommand,
): Promise<ApiResponse<DietPlan>> {
  try {
    const result = await executeDietPlanGeneration(userData, "single-food", [
      {
        label: "single-food-default",
        prompt: buildSingleFoodPrompt(userData, false),
        temperature: 0.45,
      },
      {
        label: "single-food-compact",
        prompt: buildSingleFoodPrompt(userData, true),
        temperature: 0.25,
      },
    ], {
      systemPrompt: SkillLoader.load("single-food-nutritionist"),
      validatePlan: (dietPlan) => {
        ensureDietPlanMatchesMealCount(dietPlan, userData.numberOfMeals);
        ensureSingleFoodPlanSupplements(dietPlan, userData);
      },
    });

    return {
      ...result,
      data: applyMealCountToDietPlan(result.data, userData.numberOfMeals),
    };
  } catch (error) {
    if (!shouldFallbackToDailyGeneration(error)) {
      throw error;
    }

    return generateSingleFoodPlanByDay(userData);
  }
}

export async function generateFallbackSingleFoodPlan(
  userData: DataUserCommand,
): Promise<ApiResponse<DietPlan>> {
  const result = await executeDietPlanGeneration(userData, "single-food", [
    {
      label: "single-food-fallback",
      prompt: buildSingleFoodPrompt(userData, true),
      temperature: 0.2,
    },
  ], {
    systemPrompt: SkillLoader.load("single-food-nutritionist"),
    validatePlan: (dietPlan) => {
      ensureDietPlanMatchesMealCount(dietPlan, userData.numberOfMeals);
      ensureSingleFoodPlanSupplements(dietPlan, userData);
    },
  });

  return {
    ...result,
    data: applyMealCountToDietPlan(result.data, userData.numberOfMeals),
  };
}

export function buildSingleFoodPrompt(
  userData: DataUserCommand,
  compactMode: boolean,
): string {
  const context = calculateDietContext(userData, "single-food");
  const configuredSupplements = getConfiguredSupplements(userData);
  const descriptionRule = compactMode
    ? "- Keep every description to 8 words or fewer."
    : "- Keep every description short and practical.";
  const supplementRule = buildSingleFoodSupplementRule(userData, compactMode);

  return `Create a personalized 7-day single-food diet plan.

CLIENT PROFILE:
Name: ${userData.name}
Age: ${userData.age} years | Gender: ${userData.gender}
Weight: ${userData.weight}kg | Height: ${userData.height}cm
Activity Level: ${userData.levelActivity}
Dietary Preference: ${userData.diet}
Goal: ${userData.goal}
Meals per day: ${userData.numberOfMeals}

CALCULATED NEEDS:
- Target Daily Calories: ${Math.round(context.targetCalories)} kcal
- Target Daily Kilojoules: ${Math.round(context.targetKilojoules)} kJ
- Protein Target: ${context.proteinTarget}g
- Carbs Target: ${context.carbsTarget}g
- Fats Target: ${context.fatsTarget}g

DIETARY SPECIFICATIONS:
- Avoid: ${userData.avoidedFoods.join(", ") || "None specified"}
- Allergies: ${userData.allergies.join(", ") || "None"}
- Favorite foods: ${userData.favoriteFoods.join(", ") || "None specified"}
- Current supplementation: ${configuredSupplements.join(", ") || "None specified"}

PLAN TYPE:
${context.mealStructure}

SINGLE-FOOD RULES:
- Do not generate chef-style recipes or cooking workflows.
- Each active meal slot must be a complete meal built from plain foods with exact quantities.
- Use foods like eggs, oats, yogurt, fruit, rice, chicken, vegetables, wraps, salads, milk, coffee.
- Do not include recipe steps.
- Do not include preparationTimeMinutes.
${descriptionRule}
${supplementRule}
${buildMealCountPromptGuidance(userData.numberOfMeals)}

Return only valid JSON that matches the provided response schema exactly.
Do not add markdown, comments, extra keys, or explanatory text.`;
}

async function generateSingleFoodPlanByDay(
  userData: DataUserCommand,
): Promise<ApiResponse<DietPlan>> {
  const client = createOpenAIClient();
  const systemPrompt = SkillLoader.load("single-food-nutritionist");
  const days: DietPlanDay[] = [];
  const daySchema = buildSingleFoodDayResponseSchema();

  for (let index = 0; index < singleFoodDayNames.length; index += 1) {
    const dayNumber = index + 1;
    const dayName = singleFoodDayNames[index];
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildSingleFoodDayPrompt(userData, dayNumber, dayName) },
      ],
      temperature: 0.15,
      max_tokens: Math.max(900, Math.floor(DIET_PLAN_MAX_TOKENS / 4)),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "single_food_diet_day_response",
          strict: true,
          schema: daySchema,
        },
      },
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("Failed to generate diet plan: Empty response from API");
    }

    const parsed = JSON.parse(content) as { day?: unknown };
    const day = validateDietPlanDay(parsed.day, "single-food");
    ensureDietPlanDayMatchesMealCount(day, userData.numberOfMeals);
    ensureSingleFoodDaySupplements(day, userData);
    days.push(applyMealCountToDietPlanDay(day, userData.numberOfMeals));
  }

  return {
    success: true,
    data: {
      summary: buildDietPlanSummary(userData),
      days,
    },
    metadata: {
      userId: userData.id,
      dietType: "single-food",
      attempt: "single-food-daily-fallback",
      generatedAt: new Date().toISOString(),
    },
  };
}

function buildSingleFoodDayResponseSchema(): JsonSchema {
  return {
    type: "object",
    properties: {
      day: buildDietPlanDaySchema("single-food"),
    },
    required: ["day"],
    additionalProperties: false,
  };
}

export function buildSingleFoodDayPrompt(
  userData: DataUserCommand,
  dayNumber: number,
  dayName: string,
): string {
  const context = calculateDietContext(userData, "single-food");
  const configuredSupplements = getConfiguredSupplements(userData);

  return `Create only day ${dayNumber} (${dayName}) of a single-food diet plan.

CLIENT PROFILE:
Name: ${userData.name}
Age: ${userData.age} years | Gender: ${userData.gender}
Weight: ${userData.weight}kg | Height: ${userData.height}cm
Activity Level: ${userData.levelActivity}
Dietary Preference: ${userData.diet}
Goal: ${userData.goal}
Meals per day: ${userData.numberOfMeals}

TARGETS:
- Calories: ${Math.round(context.targetCalories)} kcal
- Protein: ${context.proteinTarget}g
- Carbs: ${context.carbsTarget}g
- Fats: ${context.fatsTarget}g
- Current supplementation: ${configuredSupplements.join(", ") || "None specified"}

RULES:
- Return exactly one day object for ${dayName}.
- Use simple foods, not recipe dishes.
- Do not include cooking instructions.
- Do not include preparationTimeMinutes.
- Keep descriptions concise.
- ${buildSingleFoodDailySupplementRule(userData)}
${buildMealCountPromptGuidance(userData.numberOfMeals)}

Return only valid JSON that matches the provided response schema exactly.`;
}

function shouldFallbackToDailyGeneration(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Incomplete JSON response from API")
    || message.includes("could not parse the JSON body of your request")
    || message.includes(missingSingleFoodSupplementError)
    || message.includes(missingSixthMealSupplementError);
}

function buildSingleFoodSupplementRule(
  userData: DataUserCommand,
  compactMode: boolean,
): string {
  if (requiresSupplementSlotForMealCount(userData.numberOfMeals)) {
    if (!hasConfiguredSupplements(userData)) {
      return compactMode
        ? "- Because the user requested 6 meals per day, use supplements as a non-empty sixth intake slot with a simple protein shake or similar add-on."
        : "- Because the user requested 6 meals per day, supplements must contain a sixth intake slot such as a protein shake or simple add-on. Do not leave supplements empty.";
    }

    return compactMode
      ? "- Include each listed supplement exactly once in supplements and keep supplements non-empty for the sixth intake slot."
      : "- For every day, include the user's listed supplements in supplements and keep supplements non-empty because it also serves as the sixth intake slot.";
  }

  if (!hasConfiguredSupplements(userData)) {
    return "- Use an empty supplements array.";
  }

  return compactMode
    ? "- For every day, include each listed supplement exactly once in supplements with exact quantity and quantityUnit."
    : "- For every day, include the user's listed supplements in supplements as simple supplement entries with exact quantity and quantityUnit. Do not leave supplements empty.";
}

function buildSingleFoodDailySupplementRule(userData: DataUserCommand): string {
  if (requiresSupplementSlotForMealCount(userData.numberOfMeals)) {
    if (!hasConfiguredSupplements(userData)) {
      return "Use supplements as the sixth intake slot and do not leave the supplements array empty.";
    }

    return `Include each listed supplement exactly once in supplements for ${userData.name}, and keep supplements non-empty as the sixth intake slot: ${getConfiguredSupplements(userData).join(", ")}.`;
  }

  if (!hasConfiguredSupplements(userData)) {
    return "Use an empty supplements array.";
  }

  return `Include each listed supplement exactly once in supplements for ${userData.name}: ${getConfiguredSupplements(userData).join(", ")}.`;
}

function hasConfiguredSupplements(userData: DataUserCommand): boolean {
  return getConfiguredSupplements(userData).length > 0;
}

function getConfiguredSupplements(userData: DataUserCommand): string[] {
  return userData.supplementation
    .map((item: string) => item.trim())
    .filter(Boolean);
}

function ensureSingleFoodPlanSupplements(
  dietPlan: DietPlan,
  userData: DataUserCommand,
): void {
  for (const day of dietPlan.days) {
    ensureSingleFoodDaySupplements(day, userData);
  }
}

function ensureSingleFoodDaySupplements(
  day: DietPlanDay,
  userData: DataUserCommand,
): void {
  if (requiresSupplementSlotForMealCount(userData.numberOfMeals) && day.supplements.length === 0) {
    throw new Error(missingSixthMealSupplementError);
  }

  if (!hasConfiguredSupplements(userData)) {
    return;
  }

  const normalizedEntries = day.supplements.map((entry) => [
    entry.object,
    ...entry.ingredients.map((ingredient) => ingredient.item),
  ].join(" ").toLowerCase());

  const missingSupplements = getConfiguredSupplements(userData)
    .filter((supplement) => (
      !normalizedEntries.some((entryText) => entryText.includes(supplement.toLowerCase()))
    ));

  if (missingSupplements.length > 0) {
    throw new Error(missingSingleFoodSupplementError);
  }
}
