export type ViewKey = "dashboard" | "diet" | "workout" | "shopping" | "settings";
export type DietType = "recipes" | "single-food";
export type PlanWeek = "current" | "next";
export type EnergyUnit = "kj" | "cal";
export type ProgressPeriod = "day" | "month" | "year";
export type MealSlot =
  | "breakfast"
  | "snack1"
  | "lunch"
  | "dinner"
  | "snack2"
  | "supplements";

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  gender: string;
  weight: number;
  height: number;
  goal: string;
  diet: string;
  kindOfDiet: string;
  avoidedFoods: string[];
  allergies: string[];
  levelActivity: string;
  trainLocation: string;
  timeToTrain: number;
  injuries: string[];
  favoriteFoods: string[];
  supplementation: string[];
  numberOfMeals: number;
  energyUnitPreference: EnergyUnit;
  caloriesTarget: number;
  kilojoulesTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatsTarget: number;
  favorieteCoucineRecipes: string[];
  isPro: boolean;
}

export interface AuthAccount {
  email: string;
  provider: "password" | "google";
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: UserProfile;
  account: AuthAccount;
}

export interface StoredSession {
  token: string;
  expiresAt: string;
  userId: string;
  account: AuthAccount;
}

export interface PlanSelectionOptions {
  dietType?: DietType;
  week?: PlanWeek;
}

export interface ProfileDraft {
  name: string;
  age: string;
  gender: string;
  weight: string;
  height: string;
  goal: string;
  diet: string;
  kindOfDiet: DietType;
  avoidedFoods: string;
  allergies: string;
  levelActivity: string;
  trainLocation: string;
  timeToTrain: string;
  injuries: string;
  favoriteFoods: string;
  supplementation: string;
  numberOfMeals: string;
  energyUnitPreference: EnergyUnit;
  favorieteCoucineRecipes: string;
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
  macros: {
    protein: string;
    carbs: string;
    fats: string;
  };
  calories: number;
  kilojoules: number;
}

export interface DietPlanDayMealState {
  breakfast: boolean;
  snack1: boolean;
  lunch: boolean;
  dinner: boolean;
  snack2: boolean;
  supplements: boolean;
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
  eatenMeals?: DietPlanDayMealState;
}

export interface DietPlan {
  summary: {
    dailyCalories: number;
    macros: {
      protein: string;
      carbs: string;
      fats: string;
    };
    cuisines: string[];
  };
  days: DietPlanDay[];
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
  completed?: boolean;
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
    storageInstructions: string[];
    equipmentNeeded: string[];
  };
  pantryChecklist: string[];
  costOptimizations: string[];
}

export interface ProgressMealStatus {
  completed: boolean;
  completedAt: string | null;
  calories: number;
  kilojoules: number;
  proteinGrams: number;
  carbsGrams: number;
  fatsGrams: number;
}

export interface ProgressWorkoutStatus {
  completed: boolean;
  completedAt: string | null;
  caloriesBurned: number;
  kilojoulesBurned: number;
}

export interface ProgressTotals {
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

export interface ProgressDay {
  userId: string;
  date: string;
  planDayNumber: number;
  planDayName: string;
  targets: {
    calories: number;
    kilojoules: number;
  };
  meals: Record<MealSlot, ProgressMealStatus>;
  workout: ProgressWorkoutStatus;
  macroTotals: {
    proteinGrams: number;
    carbsGrams: number;
    fatsGrams: number;
  };
  totals: ProgressTotals;
}

export interface ProgressSummaryBreakdown extends ProgressTotals {
  label: string;
  rangeStart: string;
  rangeEnd: string;
  trackedDays: number;
}

export interface ProgressSummary {
  userId: string;
  period: ProgressPeriod;
  referenceDate: string;
  rangeStart: string;
  rangeEnd: string;
  totals: ProgressTotals & {
    trackedDays: number;
  };
  breakdown: ProgressSummaryBreakdown[];
}

export interface WeekDay {
  dayNumber: number;
  date: string;
  label: string;
  shortLabel: string;
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

export interface CreateUserResponse {
  message: string;
  data: {
    id: string;
  };
}
