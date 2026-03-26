import {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { randomUUID } from "node:crypto";
import {
  AppErrors,
  ConflictError,
  InfrastructureError,
  NotFoundError,
  ValidationError,
} from "../../share/Errors/AppErrors";
import { mysqlPool } from "../../../server/pool";
import { DataUserCommand } from "../command/DataUserCommand";
import { CreateUserRecordCommand } from "../command/CreateUserRecordCommand";
import { UserCredentials } from "../models/UserCredentials";
import { GetDataUserQuery } from "../queries/GetDataUserQuery";
import { GetUserCredentialsByEmailQuery } from "../queries/GetUserCredentialsByEmailQuery";
import {
  DietPlanEntry,
  DietPlan,
  DietPlanDayMealState,
  DietType,
  EnergyUnit,
  MacroSnapshot,
  PlanSelectionOptions,
  PlanWeek,
  SaveDietPlanOptions,
  ShoppingList,
  TrackableMealSlot,
  UserExerciseLog,
  UserExerciseLogInput,
  UserProgressDay,
  UserProgressMealStatus,
  UserTrackingEntry,
  WorkoutExercise,
  WorkoutPlan,
} from "../../../src/types";
import { RepositoryUser } from "./RepositoryUser";

interface UserRow extends RowDataPacket {
  id: string;
  name: string | null;
  age: number | string | null;
  gender: string | null;
  weight: number | string | null;
  height: number | string | null;
  goal: string | null;
  diet: string | null;
  kind_of_diet: string | null;
  energy_unit_preference: EnergyUnit | string | null;
  avoided_foods: string[] | string | null;
  allergies: string[] | string | null;
  level_activity: string | null;
  train_location: string | null;
  time_to_train: number | string | null;
  number_of_meals: number | string | null;
  calories_target: number | string | null;
  kilojoules_target: number | string | null;
  protein_target: number | string | null;
  carbs_target: number | string | null;
  fats_target: number | string | null;
  injuries: string[] | string | null;
  favorite_foods: string[] | string | null;
  supplementation: string[] | string | null;
  favoriete_coucine_recipes: string[] | string | null;
  is_pro: number | boolean | null;
}

interface UserCredentialsRow extends RowDataPacket {
  id: string;
  email: string;
  passwordHash: string;
  is_pro: number | boolean;
  google_sub: string | null;
}

interface DietPlanDayRow extends RowDataPacket {
  plan_week: string;
  summary: DietPlan["summary"] | string | null;
  day_number: number | string;
  day_name: string;
  breakfast: DietPlanEntry | string;
  snack_1: DietPlanEntry | string;
  lunch: DietPlanEntry | string;
  dinner: DietPlanEntry | string;
  snack_2: DietPlanEntry | string;
  supplements: DietPlanEntry[] | string;
  breakfast_eaten: number | boolean | null;
  snack_1_eaten: number | boolean | null;
  lunch_eaten: number | boolean | null;
  dinner_eaten: number | boolean | null;
  snack_2_eaten: number | boolean | null;
  supplements_eaten: number | boolean | null;
}

interface UserPlanStateRow extends RowDataPacket {
  kind_of_diet: string | null;
  diet_plan_summary: DietPlan["summary"] | string | null;
  workout_plan_overview: WorkoutPlan["overview"] | string | null;
}

interface WorkoutPlanDayRow extends RowDataPacket {
  day_number: number | string;
  day_name: string;
  focus: string;
  warm_up: string[] | string | null;
  exercises: WorkoutExercise[] | string;
  cool_down: string[] | string | null;
  total_duration: string;
  estimated_calories_burned: number | string | null;
  estimated_kilojoules_burned: number | string | null;
  complete: number | boolean | null;
}

interface UserProgressTrackingRow extends RowDataPacket {
  user_id: string;
  tracked_on: string | Date;
  plan_day_number: number | string;
  plan_day_name: string;
  target_calories: number | string;
  target_kilojoules: number | string;
  breakfast_completed_at: string | Date | null;
  breakfast_calories: number | string;
  breakfast_kilojoules: number | string;
  snack_1_completed_at: string | Date | null;
  snack_1_calories: number | string;
  snack_1_kilojoules: number | string;
  lunch_completed_at: string | Date | null;
  lunch_calories: number | string;
  lunch_kilojoules: number | string;
  dinner_completed_at: string | Date | null;
  dinner_calories: number | string;
  dinner_kilojoules: number | string;
  snack_2_completed_at: string | Date | null;
  snack_2_calories: number | string;
  snack_2_kilojoules: number | string;
  supplements_completed_at: string | Date | null;
  supplements_calories: number | string;
  supplements_kilojoules: number | string;
  workout_completed_at: string | Date | null;
  workout_calories_burned: number | string;
  workout_kilojoules_burned: number | string;
  total_calories_consumed: number | string;
  total_kilojoules_consumed: number | string;
  total_calories_burned: number | string;
  total_kilojoules_burned: number | string;
  net_calories: number | string;
  net_kilojoules: number | string;
  calorie_delta_from_target: number | string;
  kilojoule_delta_from_target: number | string;
  meals_completed_count: number | string;
  workouts_completed_count: number | string;
}

interface UserShoppingListRow extends RowDataPacket {
  user_id: string;
  plan_week: string;
  days_covered: number | string;
  shopping_list: ShoppingList | string;
  checked_items: string[] | string | null;
}

interface UserTrackingRow extends RowDataPacket {
  user_id: string;
  date: string | Date;
  kjs_consumed: number | string;
  macros_consumed: MacroSnapshot | string | null;
  kjs_target: number | string;
  macros_target: MacroSnapshot | string | null;
  kjs_burned: number | string;
  kjs_burned_target: number | string;
}

interface UserExerciseLogRow extends RowDataPacket {
  user_id: string;
  date: string | Date;
  exercise_name: string;
  sets_completed: number | string;
  reps_completed: number | string;
  weight_used: number | string;
  volume: number | string;
}

interface DatabaseError {
  code?: string;
  sqlMessage?: string;
}

const userSelect = `
  SELECT
    id,
    name,
    age,
    gender,
    weight,
    height,
    goal,
    diet,
    kind_of_diet,
    energy_unit_preference,
    avoided_foods,
    allergies,
    level_activity,
    train_location,
    time_to_train,
    number_of_meals,
    calories_target,
    kilojoules_target,
    protein_target,
    carbs_target,
    fats_target,
    injuries,
    favorite_foods,
    supplementation,
    favoriete_coucine_recipes,
    is_pro
  FROM users
`;

const userCredentialsSelect = `
  SELECT
    id,
    email,
    password AS passwordHash,
    is_pro,
    google_sub
  FROM users
`;

const toNumber = (value: number | string | null, fallback = 0): number => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  return fallback;
};

const toBoolean = (value: number | boolean | string | null, fallback = false): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "1" || normalizedValue === "true") {
      return true;
    }

    if (normalizedValue === "0" || normalizedValue === "false") {
      return false;
    }
  }

  return fallback;
};

const toStringArray = (value: string[] | string | null): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
};

const parseJsonValue = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return value as T;
};

const createEmptyMacroSnapshot = (): MacroSnapshot => ({
  proteinGrams: 0,
  carbsGrams: 0,
  fatsGrams: 0,
});

const parseMacroSnapshot = (value: unknown): MacroSnapshot => {
  const parsed = parseJsonValue<Partial<MacroSnapshot> | null>(value, null);

  return {
    proteinGrams: toNumber(parsed?.proteinGrams ?? null),
    carbsGrams: toNumber(parsed?.carbsGrams ?? null),
    fatsGrams: toNumber(parsed?.fatsGrams ?? null),
  };
};

const normaliseShoppingItemId = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "item";
};

const resolveShoppingItemId = (item: ShoppingList["categories"][keyof ShoppingList["categories"]][number]): string => (
  typeof item.id === "string" && item.id.trim().length > 0
    ? item.id
    : normaliseShoppingItemId(item.item)
);

const hydrateShoppingItems = (
  items: ShoppingList["categories"][keyof ShoppingList["categories"]],
  checkedItemIds: Set<string>,
): ShoppingList["categories"][keyof ShoppingList["categories"]] => (
  items.map((item) => {
    const itemId = resolveShoppingItemId(item);

    return {
      ...item,
      id: itemId,
      checked: checkedItemIds.has(itemId),
    };
  })
);

const hydrateShoppingList = (
  shoppingList: ShoppingList,
  checkedItemIds: string[],
): ShoppingList => {
  const checkedIds = new Set(checkedItemIds);

  return {
    ...shoppingList,
    categories: {
      proteins: hydrateShoppingItems(shoppingList.categories.proteins, checkedIds),
      produce: hydrateShoppingItems(shoppingList.categories.produce, checkedIds),
      pantry: hydrateShoppingItems(shoppingList.categories.pantry, checkedIds),
      dairy: hydrateShoppingItems(shoppingList.categories.dairy, checkedIds),
      frozen: hydrateShoppingItems(shoppingList.categories.frozen, checkedIds),
      beverages: hydrateShoppingItems(shoppingList.categories.beverages, checkedIds),
    },
    byStoreSection: shoppingList.byStoreSection.map((section) => ({
      ...section,
      items: hydrateShoppingItems(section.items, checkedIds),
    })),
  };
};

const collectShoppingItemIds = (shoppingList: ShoppingList): Set<string> => {
  const itemIds = new Set<string>();

  for (const category of Object.values(shoppingList.categories)) {
    for (const item of category) {
      itemIds.add(resolveShoppingItemId(item));
    }
  }

  for (const section of shoppingList.byStoreSection) {
    for (const item of section.items) {
      itemIds.add(resolveShoppingItemId(item));
    }
  }

  return itemIds;
};

const toDateString = (value: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
};

const toDateTimeString = (value: string | Date | null): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const stringValue = String(value);
  if (stringValue.includes("T")) {
    return stringValue;
  }

  return `${stringValue.replace(" ", "T")}Z`;
};

const toSqlDateTime = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  return value.slice(0, 19).replace("T", " ");
};

const assertNonEmptyString = (value: string, fieldName: string): void => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`"${fieldName}" is required.`);
  }
};

const assertFiniteNumber = (value: number, fieldName: string): void => {
  if (!Number.isFinite(value)) {
    throw new ValidationError(`"${fieldName}" must be a valid number.`);
  }
};

const assertPositiveInteger = (value: number, fieldName: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`"${fieldName}" must be a positive integer.`);
  }
};

const assertStringArray = (value: string[], fieldName: string): void => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ValidationError(`"${fieldName}" must be an array of strings.`);
  }
};

const assertBoolean = (value: boolean, fieldName: string): void => {
  if (typeof value !== "boolean") {
    throw new ValidationError(`"${fieldName}" must be a boolean.`);
  }
};

const assertPlanWeek = (value: PlanWeek): void => {
  if (value !== "current" && value !== "next") {
    throw new ValidationError(`Unsupported plan week "${value}".`);
  }
};

const assertEnergyUnit = (value: string, fieldName: string): void => {
  if (value !== "kj" && value !== "cal") {
    throw new ValidationError(`"${fieldName}" must be either "kj" or "cal".`);
  }
};

const isDatabaseError = (error: unknown): error is DatabaseError => {
  return typeof error === "object" && error !== null;
};

const handleRepositoryError = (
  error: unknown,
  duplicateMessage = "User already exists.",
): never => {
  if (error instanceof AppErrors) {
    throw error;
  }

  if (isDatabaseError(error) && error.code === "ER_DUP_ENTRY") {
    throw new ConflictError(duplicateMessage);
  }

  throw new InfrastructureError();
};

const assertSaveDataUserCommand = (
  dataUserCommand: DataUserCommand,
): void => {
  assertNonEmptyString(dataUserCommand.id, "id");
  assertNonEmptyString(dataUserCommand.name, "name");
  assertFiniteNumber(dataUserCommand.age, "age");
  assertNonEmptyString(dataUserCommand.gender, "gender");
  assertFiniteNumber(dataUserCommand.weight, "weight");
  assertFiniteNumber(dataUserCommand.height, "height");
  assertNonEmptyString(dataUserCommand.goal, "goal");
  assertNonEmptyString(dataUserCommand.diet, "diet");
  assertNonEmptyString(dataUserCommand.kindOfDiet, "kindOfDiet");
  assertStringArray(dataUserCommand.avoidedFoods, "avoidedFoods");
  assertStringArray(dataUserCommand.allergies, "allergies");
  assertNonEmptyString(dataUserCommand.levelActivity, "levelActivity");
  assertNonEmptyString(dataUserCommand.trainLocation, "trainLocation");
  assertFiniteNumber(dataUserCommand.timeToTrain, "timeToTrain");
  assertFiniteNumber(dataUserCommand.numberOfMeals, "numberOfMeals");
  if (dataUserCommand.numberOfMeals < 1 || dataUserCommand.numberOfMeals > 6) {
    throw new ValidationError("\"numberOfMeals\" must be between 1 and 6.");
  }
  assertEnergyUnit(dataUserCommand.energyUnitPreference, "energyUnitPreference");
  assertFiniteNumber(dataUserCommand.caloriesTarget, "caloriesTarget");
  assertFiniteNumber(dataUserCommand.kilojoulesTarget, "kilojoulesTarget");
  assertFiniteNumber(dataUserCommand.proteinTarget, "proteinTarget");
  assertFiniteNumber(dataUserCommand.carbsTarget, "carbsTarget");
  assertFiniteNumber(dataUserCommand.fatsTarget, "fatsTarget");
  assertStringArray(dataUserCommand.injuries, "injuries");
  assertStringArray(dataUserCommand.favoriteFoods, "favoriteFoods");
  assertStringArray(dataUserCommand.supplementation, "supplementation");
  assertStringArray(
    dataUserCommand.favorieteCoucineRecipes,
    "favorieteCoucineRecipes",
  );
};

const assertCreateUserRecordCommand = (user: CreateUserRecordCommand): void => {
  assertNonEmptyString(user.id, "id");
  assertNonEmptyString(user.email, "email");
  assertNonEmptyString(user.passwordHash, "passwordHash");
  assertBoolean(user.isPro, "isPro");
};

const assertDietPlan = (dietPlan: DietPlan): void => {
  if (
    !dietPlan.summary
    || !Array.isArray(dietPlan.days)
    || dietPlan.days.length !== 7
  ) {
    throw new ValidationError(
      "Diet plan must include a summary and exactly 7 day entries.",
    );
  }
};

const assertWorkoutPlan = (workoutPlan: WorkoutPlan): void => {
  if (
    !workoutPlan.overview
    || !Array.isArray(workoutPlan.days)
    || workoutPlan.days.length !== 7
  ) {
    throw new ValidationError(
      "Workout plan must include an overview and exactly 7 day entries.",
    );
  }
};

const assertUserProgressDay = (progressDay: UserProgressDay): void => {
  assertNonEmptyString(progressDay.userId, "userId");
  assertNonEmptyString(progressDay.date, "date");
  assertFiniteNumber(progressDay.planDayNumber, "planDayNumber");
  assertNonEmptyString(progressDay.planDayName, "planDayName");
};

const assertMacroSnapshot = (snapshot: MacroSnapshot, fieldName: string): void => {
  assertFiniteNumber(snapshot.proteinGrams, `${fieldName}.proteinGrams`);
  assertFiniteNumber(snapshot.carbsGrams, `${fieldName}.carbsGrams`);
  assertFiniteNumber(snapshot.fatsGrams, `${fieldName}.fatsGrams`);
};

const assertUserTrackingEntry = (entry: UserTrackingEntry): void => {
  assertNonEmptyString(entry.userId, "userId");
  assertNonEmptyString(entry.date, "date");
  assertFiniteNumber(entry.kjsConsumed, "kjsConsumed");
  assertMacroSnapshot(entry.macrosConsumed, "macrosConsumed");
  assertFiniteNumber(entry.kjsTarget, "kjsTarget");
  assertMacroSnapshot(entry.macrosTarget, "macrosTarget");
  assertFiniteNumber(entry.kjsBurned, "kjsBurned");
  assertFiniteNumber(entry.kjsBurnedTarget, "kjsBurnedTarget");
};

const assertUserExerciseLogInput = (log: UserExerciseLogInput): void => {
  assertNonEmptyString(log.exerciseName, "exerciseName");
  assertFiniteNumber(log.setsCompleted, "setsCompleted");
  assertFiniteNumber(log.repsCompleted, "repsCompleted");
  assertFiniteNumber(log.weightUsed, "weightUsed");

  if (log.setsCompleted < 0 || log.repsCompleted < 0 || log.weightUsed < 0) {
    throw new ValidationError("Exercise log values cannot be negative.");
  }
};

const resolveExerciseVolume = (log: UserExerciseLogInput): number => (
  Math.round(log.setsCompleted * log.repsCompleted * log.weightUsed * 100) / 100
);

const mapRowToDataUserCommand = (row: UserRow): DataUserCommand => ({
  id: row.id,
  name: row.name ?? "",
  age: toNumber(row.age),
  gender: row.gender ?? "",
  weight: toNumber(row.weight),
  height: toNumber(row.height),
  goal: row.goal ?? "",
  diet: row.diet ?? "",
  kindOfDiet: row.kind_of_diet ?? "",
  energyUnitPreference: row.energy_unit_preference === "cal" ? "cal" : "kj",
  avoidedFoods: toStringArray(row.avoided_foods),
  allergies: toStringArray(row.allergies),
  levelActivity: row.level_activity ?? "",
  trainLocation: row.train_location ?? "",
  timeToTrain: toNumber(row.time_to_train),
  numberOfMeals: toNumber(row.number_of_meals),
  caloriesTarget: toNumber(row.calories_target),
  kilojoulesTarget: toNumber(row.kilojoules_target),
  proteinTarget: toNumber(row.protein_target),
  carbsTarget: toNumber(row.carbs_target),
  fatsTarget: toNumber(row.fats_target),
  injuries: toStringArray(row.injuries),
  favoriteFoods: toStringArray(row.favorite_foods),
  supplementation: toStringArray(row.supplementation),
  favorieteCoucineRecipes: toStringArray(row.favoriete_coucine_recipes),
  isPro: Boolean(row.is_pro),
});

const mapRowToUserCredentials = (
  row: UserCredentialsRow,
): UserCredentials => ({
  id: row.id,
  email: row.email,
  passwordHash: row.passwordHash,
  isPro: Boolean(row.is_pro),
  googleSub: row.google_sub,
});

const createEmptyDietEntry = (): DietPlanEntry => ({
  object: "",
  description: "",
  quantity: 0,
  quantityUnit: "g",
  ingredients: [],
  instructions: [],
  preparationTimeMinutes: 0,
  macros: { protein: "0g", carbs: "0g", fats: "0g" },
  calories: 0,
  kilojoules: 0,
});

const createEmptyDietMealState = (): DietPlanDayMealState => ({
  breakfast: false,
  snack1: false,
  lunch: false,
  dinner: false,
  snack2: false,
  supplements: false,
});

const withDietPlanMealStates = (dietPlan: DietPlan): DietPlan => ({
  ...dietPlan,
  days: dietPlan.days.map((day) => ({
    ...day,
    eatenMeals: {
      ...createEmptyDietMealState(),
      ...day.eatenMeals,
    },
  })),
});

const mapRowsToDietPlan = (
  summary: DietPlan["summary"],
  dayRows: DietPlanDayRow[],
): DietPlan => ({
  summary,
  days: dayRows.map((row) => ({
    day: toNumber(row.day_number),
    dayName: row.day_name,
    breakfast: parseJsonValue<DietPlanEntry>(row.breakfast, createEmptyDietEntry()),
    snack1: parseJsonValue<DietPlanEntry>(row.snack_1, createEmptyDietEntry()),
    lunch: parseJsonValue<DietPlanEntry>(row.lunch, createEmptyDietEntry()),
    dinner: parseJsonValue<DietPlanEntry>(row.dinner, createEmptyDietEntry()),
    snack2: parseJsonValue<DietPlanEntry>(row.snack_2, createEmptyDietEntry()),
    supplements: parseJsonValue<DietPlanEntry[]>(row.supplements, []),
    eatenMeals: {
      breakfast: toBoolean(row.breakfast_eaten),
      snack1: toBoolean(row.snack_1_eaten),
      lunch: toBoolean(row.lunch_eaten),
      dinner: toBoolean(row.dinner_eaten),
      snack2: toBoolean(row.snack_2_eaten),
      supplements: toBoolean(row.supplements_eaten),
    },
  })),
});

const mapRowsToWorkoutPlan = (
  overview: WorkoutPlan["overview"],
  dayRows: WorkoutPlanDayRow[],
): WorkoutPlan => ({
  overview,
  days: dayRows.map((row) => ({
    day: toNumber(row.day_number),
    dayName: row.day_name,
    focus: row.focus,
    warmUp: parseJsonValue<string[]>(row.warm_up, []),
    exercises: parseJsonValue<WorkoutExercise[]>(row.exercises, []),
    coolDown: parseJsonValue<string[]>(row.cool_down, []),
    totalDuration: row.total_duration,
    estimatedCaloriesBurned: toNumber(row.estimated_calories_burned),
    estimatedKilojoulesBurned: toNumber(row.estimated_kilojoules_burned),
    completed: toBoolean(row.complete),
  })),
});

const mapProgressMealStatus = (
  completedAt: string | Date | null,
  calories: number | string,
  kilojoules: number | string,
): UserProgressMealStatus => ({
  completed: completedAt !== null,
  completedAt: toDateTimeString(completedAt),
  calories: toNumber(calories),
  kilojoules: toNumber(kilojoules),
  proteinGrams: 0,
  carbsGrams: 0,
  fatsGrams: 0,
});

const mapRowToUserProgressDay = (
  row: UserProgressTrackingRow,
): UserProgressDay => ({
  userId: row.user_id,
  date: toDateString(row.tracked_on),
  planDayNumber: toNumber(row.plan_day_number),
  planDayName: row.plan_day_name,
  targets: {
    calories: toNumber(row.target_calories),
    kilojoules: toNumber(row.target_kilojoules),
  },
  meals: {
    breakfast: mapProgressMealStatus(
      row.breakfast_completed_at,
      row.breakfast_calories,
      row.breakfast_kilojoules,
    ),
    snack1: mapProgressMealStatus(
      row.snack_1_completed_at,
      row.snack_1_calories,
      row.snack_1_kilojoules,
    ),
    lunch: mapProgressMealStatus(
      row.lunch_completed_at,
      row.lunch_calories,
      row.lunch_kilojoules,
    ),
    dinner: mapProgressMealStatus(
      row.dinner_completed_at,
      row.dinner_calories,
      row.dinner_kilojoules,
    ),
    snack2: mapProgressMealStatus(
      row.snack_2_completed_at,
      row.snack_2_calories,
      row.snack_2_kilojoules,
    ),
    supplements: mapProgressMealStatus(
      row.supplements_completed_at,
      row.supplements_calories,
      row.supplements_kilojoules,
    ),
  },
  workout: {
    completed: row.workout_completed_at !== null,
    completedAt: toDateTimeString(row.workout_completed_at),
    caloriesBurned: toNumber(row.workout_calories_burned),
    kilojoulesBurned: toNumber(row.workout_kilojoules_burned),
  },
  macroTotals: {
    proteinGrams: 0,
    carbsGrams: 0,
    fatsGrams: 0,
  },
  totals: {
    caloriesConsumed: toNumber(row.total_calories_consumed),
    kilojoulesConsumed: toNumber(row.total_kilojoules_consumed),
    caloriesBurned: toNumber(row.total_calories_burned),
    kilojoulesBurned: toNumber(row.total_kilojoules_burned),
    netCalories: toNumber(row.net_calories),
    netKilojoules: toNumber(row.net_kilojoules),
    calorieDeltaFromTarget: toNumber(row.calorie_delta_from_target),
    kilojouleDeltaFromTarget: toNumber(row.kilojoule_delta_from_target),
    mealsCompleted: toNumber(row.meals_completed_count),
    workoutsCompleted: toNumber(row.workouts_completed_count),
  },
});

const mapRowToUserTrackingEntry = (
  row: UserTrackingRow,
): UserTrackingEntry => ({
  userId: row.user_id,
  date: toDateString(row.date),
  kjsConsumed: toNumber(row.kjs_consumed),
  macrosConsumed: parseMacroSnapshot(row.macros_consumed),
  kjsTarget: toNumber(row.kjs_target),
  macrosTarget: parseMacroSnapshot(row.macros_target),
  kjsBurned: toNumber(row.kjs_burned),
  kjsBurnedTarget: toNumber(row.kjs_burned_target),
});

const mapRowToUserExerciseLog = (
  row: UserExerciseLogRow,
): UserExerciseLog => ({
  userId: row.user_id,
  date: toDateString(row.date),
  exerciseName: row.exercise_name,
  setsCompleted: toNumber(row.sets_completed),
  repsCompleted: toNumber(row.reps_completed),
  weightUsed: toNumber(row.weight_used),
  volume: toNumber(row.volume),
});

const mapRowToShoppingList = (row: UserShoppingListRow): ShoppingList => {
  const shoppingList = parseJsonValue<ShoppingList | null>(row.shopping_list, null);
  const checkedItems = toStringArray(row.checked_items);

  if (!shoppingList) {
    throw new ValidationError("Stored shopping list payload is invalid.");
  }

  return hydrateShoppingList({
    ...shoppingList,
    metadata: {
      ...shoppingList.metadata,
      daysCovered: toNumber(row.days_covered, shoppingList.metadata.daysCovered ?? 7),
    },
  }, checkedItems);
};

const resolveDietStorageTable = (dietType: DietType): string => (
  dietType === "recipes" ? "user_recipe_plan" : "user_diet_plan"
);

const resolveShoppingStorageTable = (dietType: DietType): string => (
  dietType === "recipes"
    ? "shopping_market_recipes_list"
    : "shopping_market_single_food_list"
);

const resolvePlanWeek = (requestedWeek?: PlanWeek): PlanWeek => (
  requestedWeek === "next" ? "next" : "current"
);

const resolveStoredDietType = (storedDietType?: string | null): DietType => (
  storedDietType === "single-food" ? "single-food" : "recipes"
);

const resolveDietMealStateColumn = (mealSlot: TrackableMealSlot): string => {
  switch (mealSlot) {
    case "breakfast":
      return "breakfast_eaten";
    case "snack1":
      return "snack_1_eaten";
    case "lunch":
      return "lunch_eaten";
    case "dinner":
      return "dinner_eaten";
    case "snack2":
      return "snack_2_eaten";
    case "supplements":
      return "supplements_eaten";
    default:
      throw new ValidationError(`Unsupported meal slot "${mealSlot}".`);
  }
};

export class MySqlRepositoryUser implements RepositoryUser {
  constructor(private readonly pool: Pool = mysqlPool) {}

  private async ensureUserExists(
    connection: PoolConnection,
    userId: string,
  ): Promise<void> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `
        SELECT id
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId],
    );

    if (rows.length === 0) {
      throw new NotFoundError(`User with id "${userId}" was not found.`);
    }
  }

  private async getStoredUserPlanState(userId: string): Promise<UserPlanStateRow | null> {
    const [rows] = await this.pool.execute<UserPlanStateRow[]>(
      `
        SELECT
          kind_of_diet,
          diet_plan_summary,
          workout_plan_overview
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId],
    );

    return rows[0] ?? null;
  }

  async saveUserTrackingEntry(entry: UserTrackingEntry): Promise<UserTrackingEntry> {
    assertUserTrackingEntry(entry);

    try {
      await this.pool.execute<ResultSetHeader>(
        `
          INSERT INTO user_tracking (
            user_id,
            date,
            kjs_consumed,
            macros_consumed,
            kjs_target,
            macros_target,
            kjs_burned,
            kjs_burned_target
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            kjs_consumed = VALUES(kjs_consumed),
            macros_consumed = VALUES(macros_consumed),
            kjs_target = VALUES(kjs_target),
            macros_target = VALUES(macros_target),
            kjs_burned = VALUES(kjs_burned),
            kjs_burned_target = VALUES(kjs_burned_target)
        `,
        [
          entry.userId,
          entry.date,
          Math.round(entry.kjsConsumed),
          JSON.stringify(entry.macrosConsumed),
          Math.round(entry.kjsTarget),
          JSON.stringify(entry.macrosTarget),
          Math.round(entry.kjsBurned),
          Math.round(entry.kjsBurnedTarget),
        ],
      );

      return entry;
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async listUserTrackingEntries(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<UserTrackingEntry[]> {
    assertNonEmptyString(userId, "userId");
    assertNonEmptyString(startDate, "startDate");
    assertNonEmptyString(endDate, "endDate");

    try {
      const [rows] = await this.pool.execute<UserTrackingRow[]>(
        `
          SELECT
            user_id,
            date,
            kjs_consumed,
            macros_consumed,
            kjs_target,
            macros_target,
            kjs_burned,
            kjs_burned_target
          FROM user_tracking
          WHERE user_id = ?
            AND date >= ?
            AND date <= ?
          ORDER BY date ASC
        `,
        [userId, startDate, endDate],
      );

      return rows.map(mapRowToUserTrackingEntry);
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async replaceUserExerciseLogs(
    userId: string,
    date: string,
    logs: UserExerciseLogInput[],
  ): Promise<UserExerciseLog[]> {
    assertNonEmptyString(userId, "userId");
    assertNonEmptyString(date, "date");

    for (const log of logs) {
      assertUserExerciseLogInput(log);
    }

    const normalizedLogs = logs.map<UserExerciseLog>((log) => ({
      userId,
      date,
      exerciseName: log.exerciseName,
      setsCompleted: Math.round(log.setsCompleted),
      repsCompleted: Math.round(log.repsCompleted),
      weightUsed: Math.round(log.weightUsed * 100) / 100,
      volume: resolveExerciseVolume(log),
    }));

    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      await this.ensureUserExists(connection, userId);

      await connection.execute<ResultSetHeader>(
        `
          DELETE FROM user_exercise_logs
          WHERE user_id = ?
            AND date = ?
        `,
        [userId, date],
      );

      for (const log of normalizedLogs) {
        await connection.execute<ResultSetHeader>(
          `
            INSERT INTO user_exercise_logs (
              user_id,
              date,
              exercise_name,
              sets_completed,
              reps_completed,
              weight_used,
              volume
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            log.userId,
            log.date,
            log.exerciseName,
            log.setsCompleted,
            log.repsCompleted,
            log.weightUsed,
            log.volume,
          ],
        );
      }

      await connection.commit();
      return normalizedLogs;
    } catch (error) {
      await connection.rollback();
      return handleRepositoryError(error);
    } finally {
      connection.release();
    }
  }

  async listUserExerciseLogs(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<UserExerciseLog[]> {
    assertNonEmptyString(userId, "userId");
    assertNonEmptyString(startDate, "startDate");
    assertNonEmptyString(endDate, "endDate");

    try {
      const [rows] = await this.pool.execute<UserExerciseLogRow[]>(
        `
          SELECT
            user_id,
            date,
            exercise_name,
            sets_completed,
            reps_completed,
            weight_used,
            volume
          FROM user_exercise_logs
          WHERE user_id = ?
            AND date >= ?
            AND date <= ?
          ORDER BY date ASC, exercise_name ASC
        `,
        [userId, startDate, endDate],
      );

      return rows.map(mapRowToUserExerciseLog);
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async addNewUser(user: CreateUserRecordCommand): Promise<void> {
    assertCreateUserRecordCommand(user);

    try {
      await this.pool.execute<ResultSetHeader>(
        `
          INSERT INTO users (
            id,
            email,
            password,
            is_pro
          )
          VALUES (?, ?, ?, ?)
        `,
        [
          user.id,
          user.email,
          user.passwordHash,
          user.isPro,
        ],
      );
    } catch (error) {
      handleRepositoryError(error, "A user with this id or email already exists.");
    }
  }

  async saveDataUser(dataUserCommand: DataUserCommand): Promise<void> {
    assertSaveDataUserCommand(dataUserCommand);

    try {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `
          UPDATE users
          SET
            name = ?,
            age = ?,
            gender = ?,
            weight = ?,
            height = ?,
            goal = ?,
            diet = ?,
            kind_of_diet = ?,
            energy_unit_preference = ?,
            avoided_foods = ?,
            allergies = ?,
            level_activity = ?,
            train_location = ?,
            time_to_train = ?,
            number_of_meals = ?,
            calories_target = ?,
            kilojoules_target = ?,
            protein_target = ?,
            carbs_target = ?,
            fats_target = ?,
            injuries = ?,
            favorite_foods = ?,
            supplementation = ?,
            favoriete_coucine_recipes = ?
          WHERE id = ?
        `,
        [
          dataUserCommand.name,
          dataUserCommand.age,
          dataUserCommand.gender,
          dataUserCommand.weight,
          dataUserCommand.height,
          dataUserCommand.goal,
          dataUserCommand.diet,
          dataUserCommand.kindOfDiet,
          dataUserCommand.energyUnitPreference,
          JSON.stringify(dataUserCommand.avoidedFoods),
          JSON.stringify(dataUserCommand.allergies),
          dataUserCommand.levelActivity,
          dataUserCommand.trainLocation,
          dataUserCommand.timeToTrain,
          dataUserCommand.numberOfMeals,
          dataUserCommand.caloriesTarget,
          dataUserCommand.kilojoulesTarget,
          dataUserCommand.proteinTarget,
          dataUserCommand.carbsTarget,
          dataUserCommand.fatsTarget,
          JSON.stringify(dataUserCommand.injuries),
          JSON.stringify(dataUserCommand.favoriteFoods),
          JSON.stringify(dataUserCommand.supplementation),
          JSON.stringify(dataUserCommand.favorieteCoucineRecipes),
          dataUserCommand.id,
        ],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError(
          `User with id "${dataUserCommand.id}" was not found.`,
        );
      }
    } catch (error) {
      handleRepositoryError(error);
    }
  }

  async getDataUser(query: GetDataUserQuery): Promise<DataUserCommand | null> {
    assertNonEmptyString(query.id, "id");

    try {
      const [rows] = await this.pool.execute<UserRow[]>(
        `
          ${userSelect}
          WHERE id = ?
          LIMIT 1
        `,
        [query.id],
      );

      return rows.length > 0 ? mapRowToDataUserCommand(rows[0]) : null;
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async getAllUsers(): Promise<DataUserCommand[]> {
    try {
      const [rows] = await this.pool.query<UserRow[]>(
        `
          ${userSelect}
          ORDER BY created_at DESC
        `,
      );

      return rows.map(mapRowToDataUserCommand);
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async getUserCredentialsByEmail(
    query: GetUserCredentialsByEmailQuery,
  ): Promise<UserCredentials | null> {
    assertNonEmptyString(query.email, "email");

    try {
      const [rows] = await this.pool.execute<UserCredentialsRow[]>(
        `
          ${userCredentialsSelect}
          WHERE email = ?
          LIMIT 1
        `,
        [query.email],
      );

      return rows.length > 0 ? mapRowToUserCredentials(rows[0]) : null;
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async saveUserGoogleSub(userId: string, googleSub: string): Promise<void> {
    assertNonEmptyString(userId, "userId");
    assertNonEmptyString(googleSub, "googleSub");

    try {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `
          UPDATE users
          SET google_sub = ?
          WHERE id = ?
        `,
        [googleSub, userId],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError(`User with id "${userId}" was not found.`);
      }
    } catch (error) {
      handleRepositoryError(error, "Google account is already linked to another user.");
    }
  }

  async saveDietPlan(
    userId: string,
    dietPlan: DietPlan,
    dietType: DietType,
    options?: SaveDietPlanOptions,
  ): Promise<DietPlan> {
    assertNonEmptyString(userId, "userId");
    assertDietPlan(dietPlan);

    const planWeek = resolvePlanWeek(options?.week);
    const activateDietType = options?.activateDietType !== false;
    assertPlanWeek(planWeek);

    const connection = await this.pool.getConnection();
    const storageTable = resolveDietStorageTable(dietType);

    try {
      await connection.beginTransaction();
      await this.ensureUserExists(connection, userId);

      if (planWeek === "current" && activateDietType) {
        await connection.execute<ResultSetHeader>(
          `
            UPDATE users
            SET
              kind_of_diet = ?,
              diet_plan_summary = ?
            WHERE id = ?
          `,
          [
            dietType,
            JSON.stringify(dietPlan.summary),
            userId,
          ],
        );
      }

      await connection.execute<ResultSetHeader>(
        `
          DELETE FROM ${storageTable}
          WHERE user_id = ?
            AND plan_week = ?
        `,
        [userId, planWeek],
      );

      for (const day of dietPlan.days) {
        await connection.execute<ResultSetHeader>(
          `
            INSERT INTO ${storageTable} (
              id,
              user_id,
              plan_week,
              summary,
              day_number,
              day_name,
              breakfast,
              snack_1,
              lunch,
              dinner,
              snack_2,
              supplements,
              breakfast_eaten,
              snack_1_eaten,
              lunch_eaten,
              dinner_eaten,
              snack_2_eaten,
              supplements_eaten
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            randomUUID(),
            userId,
            planWeek,
            JSON.stringify(dietPlan.summary),
            day.day,
            day.dayName,
            JSON.stringify(day.breakfast),
            JSON.stringify(day.snack1),
            JSON.stringify(day.lunch),
            JSON.stringify(day.dinner),
            JSON.stringify(day.snack2),
            JSON.stringify(day.supplements),
            false,
            false,
            false,
            false,
            false,
            false,
          ],
        );
      }

      await connection.commit();
      return withDietPlanMealStates(dietPlan);
    } catch (error) {
      await connection.rollback();
      return handleRepositoryError(error);
    } finally {
      connection.release();
    }
  }

  async getDietPlan(
    userId: string,
    options?: PlanSelectionOptions,
  ): Promise<DietPlan | null> {
    assertNonEmptyString(userId, "userId");

    try {
      const userState = await this.getStoredUserPlanState(userId);

      if (!userState) {
        return null;
      }

      const dietType = options?.dietType ?? resolveStoredDietType(userState.kind_of_diet);
      const planWeek = resolvePlanWeek(options?.week);
      const storageTable = resolveDietStorageTable(dietType);

      const [dayRows] = await this.pool.execute<DietPlanDayRow[]>(
        `
          SELECT
            plan_week,
            summary,
            day_number,
            day_name,
            breakfast,
            snack_1,
            lunch,
            dinner,
            snack_2,
            supplements,
            breakfast_eaten,
            snack_1_eaten,
            lunch_eaten,
            dinner_eaten,
            snack_2_eaten,
            supplements_eaten
          FROM ${storageTable}
          WHERE user_id = ?
            AND plan_week = ?
          ORDER BY day_number ASC
        `,
        [userId, planWeek],
      );

      if (dayRows.length === 0) {
        return null;
      }

      const summary = parseJsonValue<DietPlan["summary"] | null>(
        dayRows[0].summary,
        planWeek === "current"
          ? parseJsonValue<DietPlan["summary"] | null>(userState.diet_plan_summary, null)
          : null,
      );

      if (!summary) {
        return null;
      }

      return mapRowsToDietPlan(summary, dayRows);
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async saveWorkoutPlan(
    userId: string,
    workoutPlan: WorkoutPlan,
  ): Promise<WorkoutPlan> {
    assertNonEmptyString(userId, "userId");
    assertWorkoutPlan(workoutPlan);

    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      await this.ensureUserExists(connection, userId);

      await connection.execute<ResultSetHeader>(
        `
          UPDATE users
          SET
            workout_plan_overview = ?
          WHERE id = ?
        `,
        [
          JSON.stringify(workoutPlan.overview),
          userId,
        ],
      );

      await connection.execute<ResultSetHeader>(
        `
          DELETE FROM user_workout_plan_days
          WHERE user_id = ?
        `,
        [userId],
      );

      for (const day of workoutPlan.days) {
        await connection.execute<ResultSetHeader>(
          `
            INSERT INTO user_workout_plan_days (
              id,
              user_id,
              day_number,
              day_name,
              focus,
              warm_up,
              exercises,
              cool_down,
              total_duration,
              estimated_calories_burned,
              estimated_kilojoules_burned,
              complete
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            randomUUID(),
            userId,
            day.day,
            day.dayName,
            day.focus,
            JSON.stringify(day.warmUp ?? []),
            JSON.stringify(day.exercises),
            JSON.stringify(day.coolDown ?? []),
            day.totalDuration,
            day.estimatedCaloriesBurned ?? 0,
            day.estimatedKilojoulesBurned ?? 0,
            day.completed ?? false,
          ],
        );
      }

      await connection.commit();
      return workoutPlan;
    } catch (error) {
      await connection.rollback();
      return handleRepositoryError(error);
    } finally {
      connection.release();
    }
  }

  async getWorkoutPlan(userId: string): Promise<WorkoutPlan | null> {
    assertNonEmptyString(userId, "userId");

    try {
      const [userRows] = await this.pool.execute<UserPlanStateRow[]>(
        `
          SELECT
            workout_plan_overview
          FROM users
          WHERE id = ?
          LIMIT 1
        `,
        [userId],
      );

      if (userRows.length === 0) {
        return null;
      }

      const overview = parseJsonValue<WorkoutPlan["overview"] | null>(
        userRows[0].workout_plan_overview,
        null,
      );

      if (!overview) {
        return null;
      }

      const [dayRows] = await this.pool.execute<WorkoutPlanDayRow[]>(
        `
          SELECT
            day_number,
            day_name,
            focus,
            warm_up,
            exercises,
            cool_down,
            total_duration,
            estimated_calories_burned,
            estimated_kilojoules_burned,
            complete
          FROM user_workout_plan_days
          WHERE user_id = ?
          ORDER BY day_number ASC
        `,
        [userId],
      );

      if (dayRows.length === 0) {
        return null;
      }

      return mapRowsToWorkoutPlan(overview, dayRows);
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async saveShoppingList(
    userId: string,
    shoppingList: ShoppingList,
    dietType: DietType,
    week: PlanWeek = "current",
  ): Promise<ShoppingList> {
    assertNonEmptyString(userId, "userId");
    assertPlanWeek(week);

    const storageTable = resolveShoppingStorageTable(dietType);
    const planWeek = resolvePlanWeek(week);

    try {
      const [existingRows] = await this.pool.execute<UserShoppingListRow[]>(
        `
          SELECT
            plan_week,
            checked_items
          FROM ${storageTable}
          WHERE user_id = ?
            AND plan_week = ?
          LIMIT 1
        `,
        [userId, planWeek],
      );
      const validItemIds = collectShoppingItemIds(shoppingList);
      const preservedCheckedItems = toStringArray(existingRows[0]?.checked_items).filter((itemId) => (
        validItemIds.has(itemId)
      ));

      await this.pool.execute<ResultSetHeader>(
        `
          INSERT INTO ${storageTable} (
            id,
            user_id,
            plan_week,
            days_covered,
            shopping_list,
            checked_items
          )
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            days_covered = VALUES(days_covered),
            shopping_list = VALUES(shopping_list),
            checked_items = VALUES(checked_items)
        `,
        [
          randomUUID(),
          userId,
          planWeek,
          shoppingList.metadata.daysCovered ?? 7,
          JSON.stringify(shoppingList),
          JSON.stringify(preservedCheckedItems),
        ],
      );

      return hydrateShoppingList(shoppingList, preservedCheckedItems);
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async getShoppingList(
    userId: string,
    options?: PlanSelectionOptions,
  ): Promise<ShoppingList | null> {
    assertNonEmptyString(userId, "userId");

    try {
      const userState = await this.getStoredUserPlanState(userId);

      if (!userState && !options?.dietType) {
        return null;
      }

      const dietType = options?.dietType ?? resolveStoredDietType(userState?.kind_of_diet);
      const storageTable = resolveShoppingStorageTable(dietType);
      const planWeek = resolvePlanWeek(options?.week);
      const [rows] = await this.pool.execute<UserShoppingListRow[]>(
        `
          SELECT
            user_id,
            plan_week,
            days_covered,
            shopping_list,
            checked_items
          FROM ${storageTable}
          WHERE user_id = ?
            AND plan_week = ?
          LIMIT 1
        `,
        [userId, planWeek],
      );

      return rows.length > 0 ? mapRowToShoppingList(rows[0]) : null;
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async toggleShoppingListItem(
    userId: string,
    itemId: string,
    checked: boolean,
    options?: PlanSelectionOptions,
  ): Promise<ShoppingList> {
    assertNonEmptyString(userId, "userId");
    assertNonEmptyString(itemId, "itemId");

    try {
      const userState = await this.getStoredUserPlanState(userId);

      if (!userState && !options?.dietType) {
        throw new NotFoundError(`User with id "${userId}" was not found.`);
      }

      const dietType = options?.dietType ?? resolveStoredDietType(userState?.kind_of_diet);
      const storageTable = resolveShoppingStorageTable(dietType);
      const planWeek = resolvePlanWeek(options?.week);
      const [rows] = await this.pool.execute<UserShoppingListRow[]>(
        `
          SELECT
            user_id,
            plan_week,
            days_covered,
            shopping_list,
            checked_items
          FROM ${storageTable}
          WHERE user_id = ?
            AND plan_week = ?
          LIMIT 1
        `,
        [userId, planWeek],
      );

      if (rows.length === 0) {
        throw new NotFoundError(`Shopping list for user "${userId}" was not found.`);
      }

      const shoppingList = mapRowToShoppingList(rows[0]);
      const validItemIds = collectShoppingItemIds(shoppingList);

      if (!validItemIds.has(itemId)) {
        throw new NotFoundError(`Shopping list item "${itemId}" was not found.`);
      }

      const checkedItems = new Set(toStringArray(rows[0].checked_items));

      if (checked) {
        checkedItems.add(itemId);
      } else {
        checkedItems.delete(itemId);
      }

      const serializedCheckedItems = Array.from(checkedItems).filter((value) => validItemIds.has(value));

      await this.pool.execute<ResultSetHeader>(
        `
          UPDATE ${storageTable}
          SET checked_items = ?
          WHERE user_id = ?
            AND plan_week = ?
        `,
        [
          JSON.stringify(serializedCheckedItems),
          userId,
          planWeek,
        ],
      );

      return hydrateShoppingList(shoppingList, serializedCheckedItems);
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async saveUserProgressDay(progressDay: UserProgressDay): Promise<UserProgressDay> {
    assertUserProgressDay(progressDay);

    try {
      await this.pool.execute<ResultSetHeader>(
        `
          INSERT INTO user_progress_tracking (
            id,
            user_id,
            tracked_on,
            plan_day_number,
            plan_day_name,
            target_calories,
            target_kilojoules,
            breakfast_completed_at,
            breakfast_calories,
            breakfast_kilojoules,
            snack_1_completed_at,
            snack_1_calories,
            snack_1_kilojoules,
            lunch_completed_at,
            lunch_calories,
            lunch_kilojoules,
            dinner_completed_at,
            dinner_calories,
            dinner_kilojoules,
            snack_2_completed_at,
            snack_2_calories,
            snack_2_kilojoules,
            supplements_completed_at,
            supplements_calories,
            supplements_kilojoules,
            workout_completed_at,
            workout_calories_burned,
            workout_kilojoules_burned,
            total_calories_consumed,
            total_kilojoules_consumed,
            total_calories_burned,
            total_kilojoules_burned,
            net_calories,
            net_kilojoules,
            calorie_delta_from_target,
            kilojoule_delta_from_target,
            meals_completed_count,
            workouts_completed_count
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            plan_day_number = VALUES(plan_day_number),
            plan_day_name = VALUES(plan_day_name),
            target_calories = VALUES(target_calories),
            target_kilojoules = VALUES(target_kilojoules),
            breakfast_completed_at = VALUES(breakfast_completed_at),
            breakfast_calories = VALUES(breakfast_calories),
            breakfast_kilojoules = VALUES(breakfast_kilojoules),
            snack_1_completed_at = VALUES(snack_1_completed_at),
            snack_1_calories = VALUES(snack_1_calories),
            snack_1_kilojoules = VALUES(snack_1_kilojoules),
            lunch_completed_at = VALUES(lunch_completed_at),
            lunch_calories = VALUES(lunch_calories),
            lunch_kilojoules = VALUES(lunch_kilojoules),
            dinner_completed_at = VALUES(dinner_completed_at),
            dinner_calories = VALUES(dinner_calories),
            dinner_kilojoules = VALUES(dinner_kilojoules),
            snack_2_completed_at = VALUES(snack_2_completed_at),
            snack_2_calories = VALUES(snack_2_calories),
            snack_2_kilojoules = VALUES(snack_2_kilojoules),
            supplements_completed_at = VALUES(supplements_completed_at),
            supplements_calories = VALUES(supplements_calories),
            supplements_kilojoules = VALUES(supplements_kilojoules),
            workout_completed_at = VALUES(workout_completed_at),
            workout_calories_burned = VALUES(workout_calories_burned),
            workout_kilojoules_burned = VALUES(workout_kilojoules_burned),
            total_calories_consumed = VALUES(total_calories_consumed),
            total_kilojoules_consumed = VALUES(total_kilojoules_consumed),
            total_calories_burned = VALUES(total_calories_burned),
            total_kilojoules_burned = VALUES(total_kilojoules_burned),
            net_calories = VALUES(net_calories),
            net_kilojoules = VALUES(net_kilojoules),
            calorie_delta_from_target = VALUES(calorie_delta_from_target),
            kilojoule_delta_from_target = VALUES(kilojoule_delta_from_target),
            meals_completed_count = VALUES(meals_completed_count),
            workouts_completed_count = VALUES(workouts_completed_count)
        `,
        [
          randomUUID(),
          progressDay.userId,
          progressDay.date,
          progressDay.planDayNumber,
          progressDay.planDayName,
          progressDay.targets.calories,
          progressDay.targets.kilojoules,
          toSqlDateTime(progressDay.meals.breakfast.completedAt),
          progressDay.meals.breakfast.calories,
          progressDay.meals.breakfast.kilojoules,
          toSqlDateTime(progressDay.meals.snack1.completedAt),
          progressDay.meals.snack1.calories,
          progressDay.meals.snack1.kilojoules,
          toSqlDateTime(progressDay.meals.lunch.completedAt),
          progressDay.meals.lunch.calories,
          progressDay.meals.lunch.kilojoules,
          toSqlDateTime(progressDay.meals.dinner.completedAt),
          progressDay.meals.dinner.calories,
          progressDay.meals.dinner.kilojoules,
          toSqlDateTime(progressDay.meals.snack2.completedAt),
          progressDay.meals.snack2.calories,
          progressDay.meals.snack2.kilojoules,
          toSqlDateTime(progressDay.meals.supplements.completedAt),
          progressDay.meals.supplements.calories,
          progressDay.meals.supplements.kilojoules,
          toSqlDateTime(progressDay.workout.completedAt),
          progressDay.workout.caloriesBurned,
          progressDay.workout.kilojoulesBurned,
          progressDay.totals.caloriesConsumed,
          progressDay.totals.kilojoulesConsumed,
          progressDay.totals.caloriesBurned,
          progressDay.totals.kilojoulesBurned,
          progressDay.totals.netCalories,
          progressDay.totals.netKilojoules,
          progressDay.totals.calorieDeltaFromTarget,
          progressDay.totals.kilojouleDeltaFromTarget,
          progressDay.totals.mealsCompleted,
          progressDay.totals.workoutsCompleted,
        ],
      );

      return progressDay;
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async syncDietPlanMealEatenState(
    userId: string,
    dietType: DietType,
    dayNumber: number,
    mealSlot: TrackableMealSlot,
    eaten: boolean,
    week: PlanWeek = "current",
  ): Promise<void> {
    assertNonEmptyString(userId, "userId");
    assertNonEmptyString(dietType, "dietType");
    assertPositiveInteger(dayNumber, "dayNumber");
    assertNonEmptyString(mealSlot, "mealSlot");
    assertBoolean(eaten, "eaten");
    assertPlanWeek(week);

    const planWeek = resolvePlanWeek(week);
    const stateColumn = resolveDietMealStateColumn(mealSlot);
    const storageTable = resolveDietStorageTable(dietType);

    try {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `
          UPDATE ${storageTable}
          SET ${stateColumn} = ?
          WHERE user_id = ?
            AND plan_week = ?
            AND day_number = ?
        `,
        [
          eaten,
          userId,
          planWeek,
          dayNumber,
        ],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError(
          `Diet plan meal "${mealSlot}" for day "${dayNumber}" and user "${userId}" was not found in "${storageTable}".`,
        );
      }
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async syncWorkoutPlanDayCompletionState(
    userId: string,
    dayNumber: number,
    completed: boolean,
  ): Promise<void> {
    assertNonEmptyString(userId, "userId");
    assertPositiveInteger(dayNumber, "dayNumber");
    assertBoolean(completed, "completed");

    try {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `
          UPDATE user_workout_plan_days
          SET complete = ?
          WHERE user_id = ?
            AND day_number = ?
        `,
        [
          completed,
          userId,
          dayNumber,
        ],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError(
          `Workout plan day "${dayNumber}" for user "${userId}" was not found.`,
        );
      }
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async getUserProgressDay(userId: string, date: string): Promise<UserProgressDay | null> {
    assertNonEmptyString(userId, "userId");
    assertNonEmptyString(date, "date");

    try {
      const [rows] = await this.pool.execute<UserProgressTrackingRow[]>(
        `
          SELECT
            user_id,
            tracked_on,
            plan_day_number,
            plan_day_name,
            target_calories,
            target_kilojoules,
            breakfast_completed_at,
            breakfast_calories,
            breakfast_kilojoules,
            snack_1_completed_at,
            snack_1_calories,
            snack_1_kilojoules,
            lunch_completed_at,
            lunch_calories,
            lunch_kilojoules,
            dinner_completed_at,
            dinner_calories,
            dinner_kilojoules,
            snack_2_completed_at,
            snack_2_calories,
            snack_2_kilojoules,
            supplements_completed_at,
            supplements_calories,
            supplements_kilojoules,
            workout_completed_at,
            workout_calories_burned,
            workout_kilojoules_burned,
            total_calories_consumed,
            total_kilojoules_consumed,
            total_calories_burned,
            total_kilojoules_burned,
            net_calories,
            net_kilojoules,
            calorie_delta_from_target,
            kilojoule_delta_from_target,
            meals_completed_count,
            workouts_completed_count
          FROM user_progress_tracking
          WHERE user_id = ?
            AND tracked_on = ?
          LIMIT 1
        `,
        [userId, date],
      );

      return rows.length > 0 ? mapRowToUserProgressDay(rows[0]) : null;
    } catch (error) {
      return handleRepositoryError(error);
    }
  }

  async listUserProgressDays(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<UserProgressDay[]> {
    assertNonEmptyString(userId, "userId");
    assertNonEmptyString(startDate, "startDate");
    assertNonEmptyString(endDate, "endDate");

    try {
      const [rows] = await this.pool.execute<UserProgressTrackingRow[]>(
        `
          SELECT
            user_id,
            tracked_on,
            plan_day_number,
            plan_day_name,
            target_calories,
            target_kilojoules,
            breakfast_completed_at,
            breakfast_calories,
            breakfast_kilojoules,
            snack_1_completed_at,
            snack_1_calories,
            snack_1_kilojoules,
            lunch_completed_at,
            lunch_calories,
            lunch_kilojoules,
            dinner_completed_at,
            dinner_calories,
            dinner_kilojoules,
            snack_2_completed_at,
            snack_2_calories,
            snack_2_kilojoules,
            supplements_completed_at,
            supplements_calories,
            supplements_kilojoules,
            workout_completed_at,
            workout_calories_burned,
            workout_kilojoules_burned,
            total_calories_consumed,
            total_kilojoules_consumed,
            total_calories_burned,
            total_kilojoules_burned,
            net_calories,
            net_kilojoules,
            calorie_delta_from_target,
            kilojoule_delta_from_target,
            meals_completed_count,
            workouts_completed_count
          FROM user_progress_tracking
          WHERE user_id = ?
            AND tracked_on BETWEEN ? AND ?
          ORDER BY tracked_on ASC
        `,
        [userId, startDate, endDate],
      );

      return rows.map(mapRowToUserProgressDay);
    } catch (error) {
      return handleRepositoryError(error);
    }
  }
}
