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

const recipeDayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export async function generateRecipePlan(
  userData: DataUserCommand,
  options: { strictMode?: boolean } = {},
): Promise<ApiResponse<DietPlan>> {
  try {
    return await executeDietPlanGeneration(userData, "recipes", [
      {
        label: "recipe-default",
        prompt: buildRecipePrompt(userData, {
          strictMode: options.strictMode ?? false,
          compactMode: false,
        }),
        temperature: 0.35,
      },
      {
        label: "recipe-compact",
        prompt: buildRecipePrompt(userData, {
          strictMode: true,
          compactMode: true,
        }),
        temperature: 0.2,
      },
    ], {
      systemPrompt: SkillLoader.load("recipe-nutritionist"),
    });
  } catch (error) {
    if (!shouldFallbackToDailyGeneration(error)) {
      throw error;
    }

    return generateRecipePlanByDay(userData);
  }
}

export async function generateFallbackRecipePlan(
  userData: DataUserCommand,
): Promise<ApiResponse<DietPlan>> {
  return executeDietPlanGeneration(userData, "recipes", [
    {
      label: "recipe-fallback",
      prompt: buildRecipePrompt(userData, {
        strictMode: true,
        compactMode: true,
      }),
      temperature: 0.15,
    },
  ], {
    systemPrompt: SkillLoader.load("recipe-nutritionist"),
  });
}

function buildRecipePrompt(
  userData: DataUserCommand,
  options: { strictMode: boolean; compactMode: boolean },
): string {
  const context = calculateDietContext(userData, "recipes");
  const compactRules = options.compactMode
    ? `
- Keep every description to 8 words or fewer.
- Use 3 or 4 ingredients per meal.
- Use exactly 2 short instructions for snacks and 3 short instructions for breakfast, lunch, and dinner.
- Keep supplements as [] unless the user explicitly listed supplements.
- Keep every instruction short.
`
    : `
- Keep descriptions concise.
- Use 3 to 5 ingredients per meal.
- Use 2 to 4 short instructions per meal.
- Keep supplements minimal unless they are relevant.
`;

  return `Create a personalized 7-day recipe diet plan.

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
- Preferred cuisines: ${context.cuisineOptions}

PLAN TYPE:
${context.mealStructure}

RECIPE RULES:
- Every breakfast, snack, lunch, and dinner must be a real recipe dish, not a plain food list.
- Each meal must have a real recipe name, not just ingredient names.
- Each meal must include at least 3 ingredients.
- Each meal must include instructions and preparationTimeMinutes.
- quantityUnit should prefer "g" or "ml".
${options.strictMode ? "- STRICT: if any meal looks like single foods, rewrite it as a proper recipe dish." : ""}
${compactRules}

Return only valid JSON that matches the provided response schema exactly.
Do not add markdown, comments, extra keys, or explanatory text.`;
}

async function generateRecipePlanByDay(
  userData: DataUserCommand,
): Promise<ApiResponse<DietPlan>> {
  const client = createOpenAIClient();
  const systemPrompt = SkillLoader.load("recipe-nutritionist");
  const days: DietPlanDay[] = [];
  const daySchema = buildRecipeDayResponseSchema();

  for (let index = 0; index < recipeDayNames.length; index += 1) {
    const dayNumber = index + 1;
    const dayName = recipeDayNames[index];
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildRecipeDayPrompt(userData, dayNumber, dayName) },
      ],
      temperature: 0.15,
      max_tokens: Math.max(1200, Math.floor(DIET_PLAN_MAX_TOKENS / 3)),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "recipe_diet_day_response",
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
    days.push(validateDietPlanDay(parsed.day, "recipes"));
  }

  return {
    success: true,
    data: {
      summary: buildDietPlanSummary(userData),
      days,
    },
    metadata: {
      userId: userData.id,
      dietType: "recipes",
      attempt: "recipe-daily-fallback",
      generatedAt: new Date().toISOString(),
    },
  };
}

function buildRecipeDayResponseSchema(): JsonSchema {
  return {
    type: "object",
    properties: {
      day: buildDietPlanDaySchema("recipes"),
    },
    required: ["day"],
    additionalProperties: false,
  };
}

function buildRecipeDayPrompt(
  userData: DataUserCommand,
  dayNumber: number,
  dayName: string,
): string {
  const context = calculateDietContext(userData, "recipes");

  return `Create only day ${dayNumber} (${dayName}) of a recipe diet plan.

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
- Preferred cuisines: ${context.cuisineOptions}

RULES:
- Return exactly one day object for ${dayName}.
- Every meal must be a real recipe dish.
- Every meal must include at least 3 ingredients.
- Every meal must include 2 or 3 short instructions.
- Keep descriptions concise.
- Keep supplements as [] unless clearly needed.

Return only valid JSON that matches the provided response schema exactly.`;
}

function shouldFallbackToDailyGeneration(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Incomplete JSON response from API")
    || message.includes("could not parse the JSON body of your request");
}
