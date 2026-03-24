import {
  buildDietPlanDaySchema,
  buildDietPlanSummary,
  JsonSchema,
  executeDietPlanGeneration,
  calculateDietContext,
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

export async function generateSingleFoodPlan(
  userData: DataUserCommand,
): Promise<ApiResponse<DietPlan>> {
  try {
    return await executeDietPlanGeneration(userData, "single-food", [
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
    });
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
  return executeDietPlanGeneration(userData, "single-food", [
    {
      label: "single-food-fallback",
      prompt: buildSingleFoodPrompt(userData, true),
      temperature: 0.2,
    },
  ], {
    systemPrompt: SkillLoader.load("single-food-nutritionist"),
  });
}

function buildSingleFoodPrompt(
  userData: DataUserCommand,
  compactMode: boolean,
): string {
  const context = calculateDietContext(userData, "single-food");
  const descriptionRule = compactMode
    ? "- Keep every description to 8 words or fewer."
    : "- Keep every description short and practical.";
  const supplementRule = compactMode
    ? "- Use an empty supplements array unless the user explicitly listed supplements."
    : "- Supplements can be empty or simple non-recipe entries.";

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
- Current supplementation: ${userData.supplementation.join(", ") || "None specified"}

PLAN TYPE:
${context.mealStructure}

SINGLE-FOOD RULES:
- Do not generate chef-style recipes or cooking workflows.
- Each meal slot must be a complete meal built from plain foods with exact quantities.
- Use foods like eggs, oats, yogurt, fruit, rice, chicken, vegetables, wraps, salads, milk, coffee.
- Do not include recipe steps.
- Do not include preparationTimeMinutes.
${descriptionRule}
${supplementRule}

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
    days.push(validateDietPlanDay(parsed.day, "single-food"));
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

function buildSingleFoodDayPrompt(
  userData: DataUserCommand,
  dayNumber: number,
  dayName: string,
): string {
  const context = calculateDietContext(userData, "single-food");

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

RULES:
- Return exactly one day object for ${dayName}.
- Use simple foods, not recipe dishes.
- Do not include cooking instructions.
- Do not include preparationTimeMinutes.
- Keep descriptions concise.
- Keep supplements as [] unless clearly needed.

Return only valid JSON that matches the provided response schema exactly.`;
}

function shouldFallbackToDailyGeneration(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Incomplete JSON response from API")
    || message.includes("could not parse the JSON body of your request");
}
