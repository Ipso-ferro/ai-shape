import { generateFallbackRecipePlan, generateRecipePlan } from "./RecipePlanGenerator";
import {
  generateFallbackSingleFoodPlan,
  generateSingleFoodPlan,
} from "./SingleFoodPlanGenerator";
import {
  ApiResponse,
  DataUserCommand,
  DietPlan,
  DietType,
} from "../types";

export async function generateDietPlan(
  userData: DataUserCommand,
  dietType: DietType,
): Promise<ApiResponse<DietPlan>> {
  return dietType === "recipes"
    ? generateRecipePlan(userData)
    : generateSingleFoodPlan(userData);
}

export async function generateFallbackDietPlan(
  userData: DataUserCommand,
  dietType: DietType,
): Promise<ApiResponse<DietPlan>> {
  return dietType === "recipes"
    ? generateFallbackRecipePlan(userData)
    : generateFallbackSingleFoodPlan(userData);
}
