import type { DataUserCommand } from "../../domain/user/command/DataUserCommand";

export type { DataUserCommand };

export type DietType = "recipes" | "single-food";
export type EnergyUnit = "kj" | "cal";
export type TrackableMealSlot =
  | "breakfast"
  | "snack1"
  | "lunch"
  | "dinner"
  | "snack2"
  | "supplements";
export type UserProgressPeriod = "day" | "month" | "year";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  metadata?: Record<string, unknown>;
}

export interface DietContext {
  targetCalories: number;
  targetKilojoules: number;
  proteinTarget: number;
  carbsTarget: number;
  fatsTarget: number;
  cuisineOptions: string;
  mealStructure: string;
}

export interface DietPlanMacros {
  protein: string;
  carbs: string;
  fats: string;
}

export interface DietPlanIngredient {
  item: string;
  quantity: number;
  quantityUnit: string;
}

export interface DietPlanEntry {
  object: string;
  description: string;
  quantity: number;
  quantityUnit: string;
  ingredients: DietPlanIngredient[];
  instructions?: string[];
  preparationTimeMinutes?: number;
  macros: DietPlanMacros;
  calories?: number;
  kilojoules?: number;
}

export interface DietPlanDay {
  day: number;
  dayName: string;
  breakfast: DietPlanEntry;
  snack1: DietPlanEntry;
  lunch: DietPlanEntry;
  dinner: DietPlanEntry;
  snack2: DietPlanEntry;
  supplements: DietPlanEntry[];
}

export interface DietPlan {
  summary: {
    dailyCalories: number;
    macros: DietPlanMacros;
    cuisines: string[];
  };
  days: DietPlanDay[];
}

export interface WorkoutContext {
  equipmentDescription: string;
  injuryConsiderations: string;
}

export interface WorkoutExercise {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  notes?: string;
  alternatives?: string[];
}

export interface WorkoutPlanDay {
  day: number;
  dayName: string;
  focus: string;
  warmUp?: string[];
  exercises: WorkoutExercise[];
  coolDown?: string[];
  totalDuration: string;
  estimatedCaloriesBurned?: number;
  estimatedKilojoulesBurned?: number;
}

export interface WorkoutPlan {
  overview: {
    split: string;
    avgDuration: string;
    notes?: string[];
    estimatedWeeklyCaloriesBurned?: number;
    estimatedWeeklyKilojoulesBurned?: number;
  };
  days: WorkoutPlanDay[];
}

export interface UserProgressMealStatus {
  completed: boolean;
  completedAt: string | null;
  calories: number;
  kilojoules: number;
  proteinGrams: number;
  carbsGrams: number;
  fatsGrams: number;
}

export interface UserProgressWorkoutStatus {
  completed: boolean;
  completedAt: string | null;
  caloriesBurned: number;
  kilojoulesBurned: number;
}

export interface UserProgressTotals {
  caloriesConsumed: number;
  kilojoulesConsumed: number;
  caloriesBurned: number;
  kilojoulesBurned: number;
  netCalories: number;
  netKilojoules: number;
  calorieDeltaFromTarget: number;
  kilojouleDeltaFromTarget: number;
  mealsCompleted: number;
  workoutsCompleted: number;
}

export interface UserProgressDay {
  userId: string;
  date: string;
  planDayNumber: number;
  planDayName: string;
  targets: {
    calories: number;
    kilojoules: number;
  };
  meals: {
    breakfast: UserProgressMealStatus;
    snack1: UserProgressMealStatus;
    lunch: UserProgressMealStatus;
    dinner: UserProgressMealStatus;
    snack2: UserProgressMealStatus;
    supplements: UserProgressMealStatus;
  };
  workout: UserProgressWorkoutStatus;
  macroTotals: {
    proteinGrams: number;
    carbsGrams: number;
    fatsGrams: number;
  };
  totals: UserProgressTotals;
}

export interface UserProgressBreakdownItem extends UserProgressTotals {
  label: string;
  rangeStart: string;
  rangeEnd: string;
  trackedDays: number;
}

export interface UserProgressSummary {
  userId: string;
  period: UserProgressPeriod;
  referenceDate: string;
  rangeStart: string;
  rangeEnd: string;
  totals: UserProgressTotals & {
    trackedDays: number;
  };
  breakdown: UserProgressBreakdownItem[];
}

export interface ShoppingItem {
  id?: string;
  item: string;
  quantity: number;
  quantityUnit: string;
  category?: string;
  storeSection?: string;
  shelfLife?: string;
  isBulk?: boolean;
  isPantryStaple?: boolean;
  checked?: boolean;
}

export interface ShoppingPriceEstimateAud {
  coles: number;
  woolworths: number;
  aldi: number;
}

export interface ShoppingStoreSection {
  section: string;
  items: ShoppingItem[];
}

export interface ShoppingList {
  metadata: {
    totalItems: number;
    estimatedCost: number;
    estimatedCostAudByStore?: ShoppingPriceEstimateAud;
    recommendedStore?: "Coles" | "Woolworths" | "Aldi";
    currency?: "AUD";
    storeSections: number;
    prepTime: string;
    daysCovered?: number;
  };
  categories: {
    proteins: ShoppingItem[];
    produce: ShoppingItem[];
    pantry: ShoppingItem[];
    dairy: ShoppingItem[];
    frozen: ShoppingItem[];
    beverages: ShoppingItem[];
  };
  byStoreSection: ShoppingStoreSection[];
  mealPrepStrategy: {
    batchCookItems: string[];
    prepOrder: string[];
    storageInstructions: unknown[];
    equipmentNeeded: string[];
  };
  pantryChecklist: string[];
  costOptimizations: unknown[];
}

export interface CompletePlanError {
  type: string;
  message: string;
}

export interface CompletePlanResult {
  userId: string;
  generatedAt: string;
  dietPlan: DietPlan | null;
  workoutPlan: WorkoutPlan | null;
  shoppingList: ShoppingList | null;
  errors: CompletePlanError[];
}
