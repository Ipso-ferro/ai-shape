import { createOpenAIClient, DIET_PLAN_MAX_TOKENS, MODEL } from "./client";
import { SkillLoader } from "../utils/skillLoader";
import { 
  DataUserCommand, 
  DietType, 
  DietPlan, 
  ApiResponse, 
  DietContext,
} from "../types";

/**
 * Generates a 7-day diet plan using nutritionist skill
 */
export async function generateDietPlan(
  userData: DataUserCommand, 
  dietType: DietType
): Promise<ApiResponse<DietPlan>> {
  const client = createOpenAIClient();
  
  // Load nutritionist skill
  const systemPrompt: string = SkillLoader.load("nutritionist");
  const userPrompt: string = buildDietUserPrompt(userData, dietType);

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 1,
      max_tokens: DIET_PLAN_MAX_TOKENS,
      response_format: { type: "json_object" }
    });

    const responseContent: string | null = completion.choices[0].message.content;
    
    if (!responseContent) {
      throw new Error("Empty response from API");
    }

    const response: { dietPlan: DietPlan } = JSON.parse(responseContent);
    
    if (
      !response.dietPlan
      || !Array.isArray(response.dietPlan.days)
      || response.dietPlan.days.length !== 7
      || response.dietPlan.days.some((day) => (
        !isValidDietEntry(day.breakfast)
        || !isValidDietEntry(day.snack1)
        || !isValidDietEntry(day.lunch)
        || !isValidDietEntry(day.dinner)
        || !isValidDietEntry(day.snack2)
        || !Array.isArray(day.supplements)
        || day.supplements.some((entry) => !isValidDietEntry(entry))
      ))
    ) {
      throw new Error("Invalid diet plan structure received from API");
    }

    return {
      success: true,
      data: response.dietPlan,
      metadata: {
        userId: userData.id,
        dietType: dietType,
        generatedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error("Diet Plan Generation Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to generate diet plan: ${errorMessage}`);
  }
}

/**
 * Fallback diet plan generator
 */
export async function generateFallbackDietPlan(
  userData: DataUserCommand
): Promise<ApiResponse<DietPlan>> {
  console.log("🔄 Executing fallback diet plan (single-food mode)...");
  return generateDietPlan(userData, "single-food");
}

/**
 * Builds user prompt with context
 */
function buildDietUserPrompt(userData: DataUserCommand, dietType: DietType): string {
  const context: DietContext = calculateDietContext(userData, dietType);

  return `Create a personalized 7-day ${dietType} diet plan.

CLIENT PROFILE:
Name: ${userData.name}
Age: ${userData.age} years | Gender: ${userData.gender}
Weight: ${userData.weight}kg | Height: ${userData.height}cm
Activity Level: ${userData.levelActivity}
Dietary Preference: ${userData.diet}
Diet Style Preference: ${userData.kindOfDiet}
Goal: ${userData.goal}
Meals per day: ${userData.numberOfMeals}

CALCULATED NEEDS:
- Target Daily Calories: ${Math.round(context.targetCalories)} kcal
- Target Daily Kilojoules: ${Math.round(context.targetKilojoules)} kJ
- Protein Target: ${context.proteinTarget}g
- Carbs Target: ${context.carbsTarget}g
- Fats Target: ${context.fatsTarget}g

DIETARY SPECIFICATIONS:
- Avoid: ${userData.avoidedFoods?.join(", ") || "None specified"}
- Allergies: ${userData.allergies?.join(", ") || "None"}
- Favorite foods: ${userData.favoriteFoods?.join(", ") || "None specified"}
- Current supplementation: ${userData.supplementation?.join(", ") || "None specified"}
- Preferred cuisines: ${context.cuisineOptions}

PLAN TYPE: ${context.mealStructure}

ADDITIONAL NOTES:
${userData.isPro ? "Client is advanced - include nutrient timing and supplement suggestions." : "Keep plan simple and sustainable for beginner/intermediate level."}

Generate the complete 7-day plan now.

Every meal entry and every supplement entry must include:
- "instructions": string[] with 2 to 5 short preparation steps
- "preparationTimeMinutes": number
- For "single-food", instructions can be very simple prep or serving steps
- For "recipes", instructions must describe the actual recipe preparation

Return ONLY valid JSON with this exact top-level structure and exactly 7 entries in days:
{
  "dietPlan": {
    "summary": {
      "dailyCalories": number,
      "macros": {
        "protein": string,
        "carbs": string,
        "fats": string
      },
      "cuisines": string[]
    },
    "days": [
      {
        "day": 1,
        "dayName": "Monday",
        "breakfast": {
          "object": string,
          "description": string,
          "quantity": number,
          "quantityUnit": string,
          "ingredients": [
            {
              "item": string,
              "quantity": number,
              "quantityUnit": string
            }
          ],
          "instructions": string[],
          "preparationTimeMinutes": number,
          "macros": {
            "protein": string,
            "carbs": string,
            "fats": string
          },
          "calories": number,
          "kilojoules": number
        },
        "snack1": {
          "object": string,
          "description": string,
          "quantity": number,
          "quantityUnit": string,
          "ingredients": [
            {
              "item": string,
              "quantity": number,
              "quantityUnit": string
            }
          ],
          "instructions": string[],
          "preparationTimeMinutes": number,
          "macros": {
            "protein": string,
            "carbs": string,
            "fats": string
          },
          "calories": number,
          "kilojoules": number
        },
        "lunch": {
          "object": string,
          "description": string,
          "quantity": number,
          "quantityUnit": string,
          "ingredients": [
            {
              "item": string,
              "quantity": number,
              "quantityUnit": string
            }
          ],
          "instructions": string[],
          "preparationTimeMinutes": number,
          "macros": {
            "protein": string,
            "carbs": string,
            "fats": string
          },
          "calories": number,
          "kilojoules": number
        },
        "dinner": {
          "object": string,
          "description": string,
          "quantity": number,
          "quantityUnit": string,
          "ingredients": [
            {
              "item": string,
              "quantity": number,
              "quantityUnit": string
            }
          ],
          "instructions": string[],
          "preparationTimeMinutes": number,
          "macros": {
            "protein": string,
            "carbs": string,
            "fats": string
          },
          "calories": number,
          "kilojoules": number
        },
        "snack2": {
          "object": string,
          "description": string,
          "quantity": number,
          "quantityUnit": string,
          "ingredients": [
            {
              "item": string,
              "quantity": number,
              "quantityUnit": string
            }
          ],
          "instructions": string[],
          "preparationTimeMinutes": number,
          "macros": {
            "protein": string,
            "carbs": string,
            "fats": string
          },
          "calories": number,
          "kilojoules": number
        },
        "supplements": [
          {
            "object": string,
            "description": string,
            "quantity": number,
            "quantityUnit": string,
            "ingredients": [
              {
                "item": string,
                "quantity": number,
                "quantityUnit": string
              }
            ],
            "instructions": string[],
            "preparationTimeMinutes": number,
            "macros": {
              "protein": string,
              "carbs": string,
              "fats": string
            },
            "calories": number,
            "kilojoules": number
          }
        ]
      }
    ]
  }
}`;
}

/**
 * Calculates all diet context values
 */
function calculateDietContext(userData: DataUserCommand, dietType: DietType): DietContext {
  const cuisineOptions: string = userData.favorieteCoucineRecipes?.length > 0 
    ? userData.favorieteCoucineRecipes.join(", ") 
    : "International variety";

  const mealStructure: string = dietType === "single-food" 
    ? "SINGLE FOOD - Each meal slot must contain a main food object with exact quantity, quantityUnit (prefer g or ml), an ingredients array with one or more foods and per-ingredient quantities, short description, simple prep instructions, preparationTimeMinutes, macros, calories, and kilojoules."
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

function isValidDietEntry(entry: unknown): boolean {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as {
    object?: unknown;
    description?: unknown;
    quantity?: unknown;
    quantityUnit?: unknown;
    ingredients?: unknown;
    instructions?: unknown;
    preparationTimeMinutes?: unknown;
  };

  return typeof candidate.object === "string"
    && typeof candidate.description === "string"
    && typeof candidate.quantity === "number"
    && typeof candidate.quantityUnit === "string"
    && Array.isArray(candidate.ingredients)
    && (
      candidate.instructions === undefined
      || Array.isArray(candidate.instructions)
    )
    && (
      candidate.preparationTimeMinutes === undefined
      || typeof candidate.preparationTimeMinutes === "number"
    );
}
