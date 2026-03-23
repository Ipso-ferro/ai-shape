import {
  generateDietPlan,
  generateFallbackDietPlan,
} from "../api/dietPlanGenerator";
import {
  generateWorkoutPlan,
  generateFallbackWorkoutPlan,
} from "../api/workOutPlanGenerator";
import {
  generateShoppingList,
  generateBasicShoppingList,
} from "../api/shoppingListGenerator";
import { validateDietType, validateUserData } from "../utils/validators";
import {
  ApiResponse,
  CompletePlanResult,
  DataUserCommand,
  DietPlan,
  DietType,
  ShoppingList,
  WorkoutPlan,
} from "../types";

interface GenerationStrategy<T> {
  name: string;
  primary: () => Promise<ApiResponse<T>>;
  fallback: () => Promise<ApiResponse<T>> | T;
}

export async function generateCompletePlan(
  userData: DataUserCommand,
  dietType: DietType = "recipes",
): Promise<CompletePlanResult> {
  validateUserData(userData);
  validateDietType(dietType);

  const result: CompletePlanResult = {
    userId: userData.id,
    generatedAt: new Date().toISOString(),
    dietPlan: null,
    workoutPlan: null,
    shoppingList: null,
    errors: [],
  };

  const dietStrategy: GenerationStrategy<DietPlan> = {
    name: "diet-plan",
    primary: () => generateDietPlan(userData, dietType),
    fallback: () => generateFallbackDietPlan(userData, dietType),
  };

  const workoutStrategy: GenerationStrategy<WorkoutPlan> = {
    name: "workout-plan",
    primary: () => generateWorkoutPlan(userData),
    fallback: () => generateFallbackWorkoutPlan(userData),
  };

  const [dietPlan, workoutPlan] = await Promise.all([
    executeWithFallback(dietStrategy, result.errors),
    executeWithFallback(workoutStrategy, result.errors),
  ]);

  result.dietPlan = dietPlan;
  result.workoutPlan = workoutPlan;

  if (dietPlan) {
    const shoppingStrategy: GenerationStrategy<ShoppingList> = {
      name: "shopping-list",
      primary: () => generateShoppingList(dietPlan, userData.id, dietType),
      fallback: () => generateBasicShoppingList(dietPlan),
    };

    result.shoppingList = await executeWithFallback(
      shoppingStrategy,
      result.errors,
    );
  }

  return result;
}

async function executeWithFallback<T>(
  strategy: GenerationStrategy<T>,
  errorLog: CompletePlanResult["errors"],
): Promise<T | null> {
  try {
    const result = await strategy.primary();
    return result.data;
  } catch (primaryError) {
    errorLog.push({
      type: strategy.name,
      message: primaryError instanceof Error ? primaryError.message : "Unknown error",
    });
  }

  try {
    const fallbackResult = await strategy.fallback();

    if (isApiResponse(fallbackResult)) {
      return fallbackResult.data;
    }

    return fallbackResult;
  } catch (fallbackError) {
    errorLog.push({
      type: `${strategy.name}-fallback`,
      message: fallbackError instanceof Error ? fallbackError.message : "Unknown error",
    });
    return null;
  }
}

function isApiResponse<T>(value: ApiResponse<T> | T): value is ApiResponse<T> {
  return typeof value === "object"
    && value !== null
    && "success" in value
    && "data" in value;
}
