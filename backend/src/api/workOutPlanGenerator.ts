import { createOpenAIClient, MODEL, WORKOUT_PLAN_MAX_TOKENS } from "./client";
import { SkillLoader } from "../utils/skillLoader";
import {
  ApiResponse,
  DataUserCommand,
  WorkoutContext,
  WorkoutPlan,
} from "../types";

export async function generateWorkoutPlan(
  userData: DataUserCommand,
): Promise<ApiResponse<WorkoutPlan>> {
  const client = createOpenAIClient();
  const systemPrompt = SkillLoader.load("coach");
  const userPrompt = buildWorkoutUserPrompt(userData);

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 1,
      max_tokens: WORKOUT_PLAN_MAX_TOKENS,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("Empty response from API");
    }

    const response = JSON.parse(responseContent) as {
      workoutPlan?: WorkoutPlan;
    };

    if (
      !response.workoutPlan
      || !Array.isArray(response.workoutPlan.days)
      || response.workoutPlan.days.length !== 7
      || response.workoutPlan.days.some((day) => (
        typeof day.estimatedCaloriesBurned !== "number"
        || typeof day.estimatedKilojoulesBurned !== "number"
      ))
    ) {
      throw new Error("Invalid workout plan structure received from API");
    }

    return {
      success: true,
      data: response.workoutPlan,
      metadata: {
        userId: userData.id,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to generate workout plan: ${errorMessage}`);
  }
}

export async function generateFallbackWorkoutPlan(
  userData: DataUserCommand,
): Promise<ApiResponse<WorkoutPlan>> {
  const modifiedUserData: DataUserCommand = {
    ...userData,
    trainLocation: "home",
    timeToTrain: 30,
  };

  return generateWorkoutPlan(modifiedUserData);
}

function buildWorkoutUserPrompt(userData: DataUserCommand): string {
  const context = calculateWorkoutContext(userData);

  return `Create a personalized 7-day workout plan.

CLIENT PROFILE:
Name: ${userData.name}
Age: ${userData.age} years | Gender: ${userData.gender}
Weight: ${userData.weight}kg | Height: ${userData.height}cm
Current Activity Level: ${userData.levelActivity}
Training Goal: ${userData.goal}
Experience Level: ${userData.isPro ? "Advanced" : "Intermediate"}

TRAINING ENVIRONMENT:
Location: ${userData.trainLocation}
Equipment Available: ${context.equipmentDescription}
Time Available: ${userData.timeToTrain} minutes per session (includes warm-up and cool-down)

SAFETY CONSIDERATIONS:
${context.injuryConsiderations}

PROGRAM REQUIREMENTS:
- Design ${userData.isPro ? "advanced program with drop sets, supersets, tempo training" : "straightforward program focusing on form and consistency"}
- Progressively increase intensity through the week
- Balance muscle groups appropriately
- Include specific rest periods between sets
- Provide alternative exercises for equipment limitations
- Fit everything within ${userData.timeToTrain} minutes including warm-up and cool-down

Generate the complete 7-day training plan now.

Return ONLY valid JSON with this exact top-level structure and exactly 7 entries in days:
{
  "workoutPlan": {
    "overview": {
      "split": string,
      "avgDuration": string,
      "notes": string[],
      "estimatedWeeklyCaloriesBurned": number,
      "estimatedWeeklyKilojoulesBurned": number
    },
    "days": [
      {
        "day": 1,
        "dayName": "Monday",
        "focus": string,
        "warmUp": string[],
        "exercises": [
          {
            "name": string,
            "sets": string,
            "reps": string,
            "rest": string,
            "notes": string,
            "alternatives": string[]
          }
        ],
        "coolDown": string[],
        "totalDuration": string,
        "estimatedCaloriesBurned": number,
        "estimatedKilojoulesBurned": number
      }
    ]
  }
}`;
}

function calculateWorkoutContext(userData: DataUserCommand): WorkoutContext {
  const equipmentDescription = getEquipmentDescription(userData.trainLocation);

  const injuryConsiderations = userData.injuries.length > 0
    ? `CRITICAL - Work around these injuries: ${userData.injuries.join(", ")}. Provide alternative exercises and modifications.`
    : "No injury limitations - standard exercise selection applies.";

  return { equipmentDescription, injuryConsiderations };
}

function getEquipmentDescription(trainLocation: string): string {
  switch (trainLocation.toLowerCase()) {
    case "gym":
      return "Full gym equipment (barbells, dumbbells, machines, cables, cardio equipment)";
    case "home":
      return "Minimal equipment (dumbbells, resistance bands, bodyweight, yoga mat)";
    case "outdoor":
      return "No equipment, park/outdoor setting (benches, pull-up bars, open space)";
    case "hybrid":
      return "Mix of gym and home equipment (adjustable dumbbells, bands, basic machines)";
    default:
      return `Custom training setup: ${trainLocation}`;
  }
}
