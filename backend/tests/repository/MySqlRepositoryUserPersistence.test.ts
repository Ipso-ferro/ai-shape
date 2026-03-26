import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { MySqlRepositoryUser } from "../../domain/user/repositories/MySqlRepositoryUser";
import { mysqlPool } from "../../server/pool";
import { initializeDatabaseSchema } from "../../server/initializers/DatabaseSchemaInitializing";
import {
  DietPlan,
  ShoppingList,
  UserExerciseLogInput,
  UserTrackingEntry,
  UserWaterEntry,
  WorkoutPlan,
} from "../../src/types";

interface CountRow extends RowDataPacket {
  count: number;
}

interface UserStateRow extends RowDataPacket {
  kind_of_diet: string | null;
}

interface BooleanStateRow extends RowDataPacket {
  id: string | null;
  breakfast_eaten?: number | boolean | null;
  snack_1_eaten?: number | boolean | null;
  lunch_eaten?: number | boolean | null;
  dinner_eaten?: number | boolean | null;
  snack_2_eaten?: number | boolean | null;
  supplements_eaten?: number | boolean | null;
  complete?: number | boolean | null;
}

interface ProgressTrackingStateRow extends RowDataPacket {
  id: string | null;
}

interface TrackingStateRow extends RowDataPacket {
  date: string;
  kjs_consumed: number;
  macros_consumed: string | Record<string, unknown>;
  kjs_target: number;
  macros_target: string | Record<string, unknown>;
  kjs_burned: number;
  kjs_burned_target: number;
}

interface ExerciseLogStateRow extends RowDataPacket {
  exercise_name: string;
  sets_completed: number;
  reps_completed: number;
  weight_used: string | number;
  volume: string | number;
}

interface WaterStateRow extends RowDataPacket {
  date: string;
  target_liters: string | number;
  target_glasses: number;
  glasses_completed: number;
  liters_per_glass: string | number;
}

const repository = new MySqlRepositoryUser(mysqlPool);
const dayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

test.before(async () => {
  await initializeDatabaseSchema(mysqlPool);
});

test.after(async () => {
  await mysqlPool.end();
});

const buildRecipePlan = (): DietPlan => ({
  summary: {
    dailyCalories: 2400,
    macros: {
      protein: "180g",
      carbs: "220g",
      fats: "70g",
    },
    cuisines: ["mediterranean"],
  },
  days: Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    dayName: dayNames[index],
    breakfast: {
      object: `Recipe Breakfast ${index + 1}`,
      description: "Cooked breakfast bowl.",
      quantity: 320,
      quantityUnit: "g",
      ingredients: [
        { item: "Eggs", quantity: 150, quantityUnit: "g" },
        { item: "Spinach", quantity: 70, quantityUnit: "g" },
        { item: "Feta", quantity: 40, quantityUnit: "g" },
      ],
      instructions: ["Prep ingredients.", "Cook and plate."],
      preparationTimeMinutes: 12,
      macros: {
        protein: "28g",
        carbs: "18g",
        fats: "14g",
      },
      calories: 340,
      kilojoules: 1423,
    },
    snack1: {
      object: `Recipe Snack ${index + 1}`,
      description: "Layered yogurt parfait.",
      quantity: 220,
      quantityUnit: "g",
      ingredients: [
        { item: "Greek yogurt", quantity: 140, quantityUnit: "g" },
        { item: "Berries", quantity: 50, quantityUnit: "g" },
        { item: "Granola", quantity: 30, quantityUnit: "g" },
      ],
      instructions: ["Layer ingredients.", "Serve chilled."],
      preparationTimeMinutes: 5,
      macros: {
        protein: "18g",
        carbs: "20g",
        fats: "5g",
      },
      calories: 190,
      kilojoules: 795,
    },
    lunch: {
      object: `Recipe Lunch ${index + 1}`,
      description: "Chicken grain bowl.",
      quantity: 460,
      quantityUnit: "g",
      ingredients: [
        { item: "Chicken breast", quantity: 180, quantityUnit: "g" },
        { item: "Rice", quantity: 180, quantityUnit: "g" },
        { item: "Broccoli", quantity: 100, quantityUnit: "g" },
      ],
      instructions: ["Cook the chicken.", "Assemble with grains and vegetables."],
      preparationTimeMinutes: 18,
      macros: {
        protein: "42g",
        carbs: "48g",
        fats: "10g",
      },
      calories: 520,
      kilojoules: 2176,
    },
    dinner: {
      object: `Recipe Dinner ${index + 1}`,
      description: "Salmon vegetable plate.",
      quantity: 430,
      quantityUnit: "g",
      ingredients: [
        { item: "Salmon", quantity: 180, quantityUnit: "g" },
        { item: "Potatoes", quantity: 170, quantityUnit: "g" },
        { item: "Asparagus", quantity: 80, quantityUnit: "g" },
      ],
      instructions: ["Roast the potatoes.", "Cook salmon and serve with asparagus."],
      preparationTimeMinutes: 22,
      macros: {
        protein: "40g",
        carbs: "34g",
        fats: "18g",
      },
      calories: 510,
      kilojoules: 2134,
    },
    snack2: {
      object: `Recipe Shake ${index + 1}`,
      description: "Blended recovery shake.",
      quantity: 350,
      quantityUnit: "ml",
      ingredients: [
        { item: "Milk", quantity: 220, quantityUnit: "ml" },
        { item: "Whey protein", quantity: 30, quantityUnit: "g" },
        { item: "Banana", quantity: 100, quantityUnit: "g" },
      ],
      instructions: ["Add ingredients to blender.", "Blend until smooth."],
      preparationTimeMinutes: 4,
      macros: {
        protein: "26g",
        carbs: "24g",
        fats: "6g",
      },
      calories: 250,
      kilojoules: 1046,
    },
    supplements: [
      {
        object: "Creatine",
        description: "Daily creatine serving.",
        quantity: 5,
        quantityUnit: "g",
        ingredients: [
          { item: "Creatine monohydrate", quantity: 5, quantityUnit: "g" },
        ],
        macros: {
          protein: "0g",
          carbs: "0g",
          fats: "0g",
        },
        calories: 0,
        kilojoules: 0,
      },
    ],
  })),
});

const buildSingleFoodPlan = (): DietPlan => ({
  summary: {
    dailyCalories: 2200,
    macros: {
      protein: "170g",
      carbs: "200g",
      fats: "65g",
    },
    cuisines: ["international"],
  },
  days: Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    dayName: dayNames[index],
    breakfast: {
      object: `Egg breakfast ${index + 1}`,
      description: "Eggs with toast and coffee.",
      quantity: 300,
      quantityUnit: "g",
      ingredients: [
        { item: "Eggs", quantity: 150, quantityUnit: "g" },
        { item: "Toast", quantity: 80, quantityUnit: "g" },
        { item: "Coffee", quantity: 200, quantityUnit: "ml" },
      ],
      macros: {
        protein: "24g",
        carbs: "20g",
        fats: "14g",
      },
      calories: 320,
      kilojoules: 1339,
    },
    snack1: {
      object: `Yogurt snack ${index + 1}`,
      description: "Yogurt with fruit.",
      quantity: 220,
      quantityUnit: "g",
      ingredients: [
        { item: "Greek yogurt", quantity: 170, quantityUnit: "g" },
        { item: "Banana", quantity: 50, quantityUnit: "g" },
      ],
      macros: {
        protein: "18g",
        carbs: "18g",
        fats: "4g",
      },
      calories: 180,
      kilojoules: 753,
    },
    lunch: {
      object: `Chicken lunch ${index + 1}`,
      description: "Chicken rice and vegetables.",
      quantity: 450,
      quantityUnit: "g",
      ingredients: [
        { item: "Chicken breast", quantity: 180, quantityUnit: "g" },
        { item: "Rice", quantity: 180, quantityUnit: "g" },
        { item: "Vegetables", quantity: 90, quantityUnit: "g" },
      ],
      macros: {
        protein: "40g",
        carbs: "44g",
        fats: "9g",
      },
      calories: 500,
      kilojoules: 2092,
    },
    dinner: {
      object: `Fish dinner ${index + 1}`,
      description: "Fish with potatoes and salad.",
      quantity: 430,
      quantityUnit: "g",
      ingredients: [
        { item: "Fish", quantity: 180, quantityUnit: "g" },
        { item: "Potatoes", quantity: 170, quantityUnit: "g" },
        { item: "Salad", quantity: 80, quantityUnit: "g" },
      ],
      macros: {
        protein: "38g",
        carbs: "30g",
        fats: "14g",
      },
      calories: 460,
      kilojoules: 1925,
    },
    snack2: {
      object: `Shake ${index + 1}`,
      description: "Protein shake with milk.",
      quantity: 300,
      quantityUnit: "ml",
      ingredients: [
        { item: "Milk", quantity: 250, quantityUnit: "ml" },
        { item: "Whey protein", quantity: 30, quantityUnit: "g" },
      ],
      macros: {
        protein: "25g",
        carbs: "15g",
        fats: "5g",
      },
      calories: 210,
      kilojoules: 879,
    },
    supplements: [],
  })),
});

const buildWorkoutPlan = (): WorkoutPlan => ({
  overview: {
    split: "Upper / Lower",
    avgDuration: "60 min",
    estimatedWeeklyCaloriesBurned: 2100,
    estimatedWeeklyKilojoulesBurned: 8786,
  },
  days: Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    dayName: dayNames[index],
    focus: `Focus ${index + 1}`,
    warmUp: ["Row 5 min"],
    exercises: [
      {
        name: `Exercise ${index + 1}`,
        sets: "3",
        reps: "10",
        rest: "60 sec",
      },
    ],
    coolDown: ["Stretch"],
    totalDuration: "60 min",
    estimatedCaloriesBurned: 300 + index,
    estimatedKilojoulesBurned: 1255 + index,
  })),
});

const createUser = async (userId: string): Promise<void> => {
  await mysqlPool.execute<ResultSetHeader>(
    `
      INSERT INTO users (
        id,
        email,
        password,
        is_pro
      ) VALUES (?, ?, ?, ?)
    `,
    [userId, `${userId}@example.com`, "hash:salt", 0],
  );
};

const getCount = async (tableName: "user_recipe_plan" | "user_diet_plan", userId: string): Promise<number> => {
  const [rows] = await mysqlPool.execute<CountRow[]>(
    `SELECT COUNT(*) AS count FROM ${tableName} WHERE user_id = ?`,
    [userId],
  );

  return rows[0]?.count ?? 0;
};

const getUserDietType = async (userId: string): Promise<string | null> => {
  const [rows] = await mysqlPool.execute<UserStateRow[]>(
    "SELECT kind_of_diet FROM users WHERE id = ? LIMIT 1",
    [userId],
  );

  return rows[0]?.kind_of_diet ?? null;
};

const getDietWeekCount = async (
  tableName: "user_recipe_plan" | "user_diet_plan",
  userId: string,
  week: "current" | "next",
): Promise<number> => {
  const [rows] = await mysqlPool.execute<CountRow[]>(
    `SELECT COUNT(*) AS count FROM ${tableName} WHERE user_id = ? AND plan_week = ?`,
    [userId, week],
  );

  return rows[0]?.count ?? 0;
};

const getDietRowState = async (
  tableName: "user_recipe_plan" | "user_diet_plan",
  userId: string,
  week: "current" | "next",
  dayNumber: number,
): Promise<BooleanStateRow | null> => {
  const [rows] = await mysqlPool.execute<BooleanStateRow[]>(
    `SELECT id, breakfast_eaten, snack_1_eaten, lunch_eaten, dinner_eaten, snack_2_eaten, supplements_eaten FROM ${tableName} WHERE user_id = ? AND plan_week = ? AND day_number = ? LIMIT 1`,
    [userId, week, dayNumber],
  );

  return rows[0] ?? null;
};

const getWorkoutRowState = async (
  userId: string,
  dayNumber: number,
): Promise<BooleanStateRow | null> => {
  const [rows] = await mysqlPool.execute<BooleanStateRow[]>(
    "SELECT id, complete FROM user_workout_plan_days WHERE user_id = ? AND day_number = ? LIMIT 1",
    [userId, dayNumber],
  );

  return rows[0] ?? null;
};

const getProgressTrackingRowState = async (
  userId: string,
  trackedOn: string,
): Promise<ProgressTrackingStateRow | null> => {
  const [rows] = await mysqlPool.execute<ProgressTrackingStateRow[]>(
    "SELECT id FROM user_progress_tracking WHERE user_id = ? AND tracked_on = ? LIMIT 1",
    [userId, trackedOn],
  );

  return rows[0] ?? null;
};

const getTrackingRowState = async (
  userId: string,
  date: string,
): Promise<TrackingStateRow | null> => {
  const [rows] = await mysqlPool.execute<TrackingStateRow[]>(
    "SELECT date, kjs_consumed, macros_consumed, kjs_target, macros_target, kjs_burned, kjs_burned_target FROM user_tracking WHERE user_id = ? AND date = ? LIMIT 1",
    [userId, date],
  );

  return rows[0] ?? null;
};

const getExerciseLogRows = async (
  userId: string,
  date: string,
): Promise<ExerciseLogStateRow[]> => {
  const [rows] = await mysqlPool.execute<ExerciseLogStateRow[]>(
    "SELECT exercise_name, sets_completed, reps_completed, weight_used, volume FROM user_exercise_logs WHERE user_id = ? AND date = ? ORDER BY exercise_name ASC",
    [userId, date],
  );

  return rows;
};

const getWaterRowState = async (
  userId: string,
  date: string,
): Promise<WaterStateRow | null> => {
  const [rows] = await mysqlPool.execute<WaterStateRow[]>(
    "SELECT date, target_liters, target_glasses, glasses_completed, liters_per_glass FROM user_water WHERE user_id = ? AND date = ? LIMIT 1",
    [userId, date],
  );

  return rows[0] ?? null;
};

const parseJsonColumn = (value: string | Record<string, unknown>): Record<string, unknown> => (
  typeof value === "string" ? JSON.parse(value) : value
);

const buildShoppingList = (label: string): ShoppingList => ({
  metadata: {
    totalItems: 3,
    estimatedCost: 42,
    recommendedStore: "Aldi",
    currency: "AUD",
    storeSections: 2,
    prepTime: "45 minutes",
    daysCovered: 7,
  },
  categories: {
    proteins: [
      { id: `${label}-protein`, item: `${label} chicken`, quantity: 1200, quantityUnit: "g" },
    ],
    produce: [
      { id: `${label}-produce`, item: `${label} spinach`, quantity: 400, quantityUnit: "g" },
    ],
    pantry: [],
    dairy: [],
    frozen: [],
    beverages: [
      { id: `${label}-drink`, item: `${label} milk`, quantity: 2000, quantityUnit: "ml" },
    ],
  },
  byStoreSection: [
    {
      section: "Protein",
      items: [
        { id: `${label}-protein`, item: `${label} chicken`, quantity: 1200, quantityUnit: "g" },
      ],
    },
    {
      section: "Fridge",
      items: [
        { id: `${label}-drink`, item: `${label} milk`, quantity: 2000, quantityUnit: "ml" },
      ],
    },
  ],
  mealPrepStrategy: {
    batchCookItems: ["Chicken"],
    prepOrder: ["Cook protein"],
    storageInstructions: ["Keep chilled"],
    equipmentNeeded: ["Pan"],
  },
  pantryChecklist: ["Salt"],
  costOptimizations: ["Buy in bulk"],
});

const getShoppingWeekCount = async (
  tableName: "shopping_market_recipes_list" | "shopping_market_single_food_list",
  userId: string,
  week: "current" | "next",
): Promise<number> => {
  const [rows] = await mysqlPool.execute<CountRow[]>(
    `SELECT COUNT(*) AS count FROM ${tableName} WHERE user_id = ? AND plan_week = ?`,
    [userId, week],
  );

  return rows[0]?.count ?? 0;
};

test("recipe plans persist in user_recipe_plan and load back from the repository", async (t) => {
  const userId = randomUUID();
  t.after(async () => {
    await mysqlPool.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [userId]);
  });

  await createUser(userId);
  const recipePlan = buildRecipePlan();

  await repository.saveDietPlan(userId, recipePlan, "recipes");

  assert.equal(await getUserDietType(userId), "recipes");
  assert.equal(await getDietWeekCount("user_recipe_plan", userId, "current"), 7);
  assert.equal(await getDietWeekCount("user_recipe_plan", userId, "next"), 0);
  assert.equal(await getCount("user_diet_plan", userId), 0);

  const storedPlan = await repository.getDietPlan(userId);

  assert.ok(storedPlan);
  const recipeBreakfast = storedPlan.days[0]?.breakfast;

  assert.equal(storedPlan.days.length, 7);
  assert.ok(recipeBreakfast?.instructions);
  assert.equal(recipeBreakfast?.instructions?.length, 2);
  assert.equal(recipeBreakfast?.preparationTimeMinutes, 12);
  assert.equal(storedPlan.days[0]?.eatenMeals?.breakfast, false);
});

test("single-food plans persist in user_diet_plan and load back from the repository", async (t) => {
  const userId = randomUUID();
  t.after(async () => {
    await mysqlPool.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [userId]);
  });

  await createUser(userId);
  const singleFoodPlan = buildSingleFoodPlan();

  await repository.saveDietPlan(userId, singleFoodPlan, "single-food");

  assert.equal(await getUserDietType(userId), "single-food");
  assert.equal(await getCount("user_recipe_plan", userId), 0);
  assert.equal(await getDietWeekCount("user_diet_plan", userId, "current"), 7);
  assert.equal(await getDietWeekCount("user_diet_plan", userId, "next"), 0);

  const storedPlan = await repository.getDietPlan(userId);

  assert.ok(storedPlan);
  assert.equal(storedPlan.days.length, 7);
  assert.equal(storedPlan.days[0].breakfast.object, "Egg breakfast 1");
  assert.equal(storedPlan.days[0].breakfast.instructions, undefined);
  assert.equal(storedPlan.days[0].eatenMeals?.breakfast, false);
});

test("current and next week plans persist independently by diet type", async (t) => {
  const userId = randomUUID();
  t.after(async () => {
    await mysqlPool.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [userId]);
  });

  await createUser(userId);

  const recipeCurrent = buildRecipePlan();
  const recipeNext = buildRecipePlan();
  recipeNext.summary.dailyCalories = 2500;
  recipeNext.days[0].breakfast.object = "Recipe Breakfast Next Week";

  const singleFoodCurrent = buildSingleFoodPlan();
  singleFoodCurrent.days[0].breakfast.object = "Egg breakfast current";

  await repository.saveDietPlan(userId, recipeCurrent, "recipes", { week: "current" });
  await repository.saveDietPlan(userId, recipeNext, "recipes", { week: "next" });
  await repository.saveDietPlan(userId, singleFoodCurrent, "single-food", { week: "current" });

  assert.equal(await getDietWeekCount("user_recipe_plan", userId, "current"), 7);
  assert.equal(await getDietWeekCount("user_recipe_plan", userId, "next"), 7);
  assert.equal(await getDietWeekCount("user_diet_plan", userId, "current"), 7);

  const storedRecipeCurrent = await repository.getDietPlan(userId, {
    dietType: "recipes",
    week: "current",
  });
  const storedRecipeNext = await repository.getDietPlan(userId, {
    dietType: "recipes",
    week: "next",
  });
  const storedSingleFoodCurrent = await repository.getDietPlan(userId, {
    dietType: "single-food",
    week: "current",
  });

  assert.equal(storedRecipeCurrent?.days[0]?.breakfast.object, recipeCurrent.days[0].breakfast.object);
  assert.equal(storedRecipeNext?.days[0]?.breakfast.object, "Recipe Breakfast Next Week");
  assert.equal(storedSingleFoodCurrent?.days[0]?.breakfast.object, "Egg breakfast current");
});

test("saving an alternate diet table without activation keeps the current user diet type", async (t) => {
  const userId = randomUUID();
  t.after(async () => {
    await mysqlPool.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [userId]);
  });

  await createUser(userId);

  const singleFoodPlan = buildSingleFoodPlan();
  const recipePlan = buildRecipePlan();

  await repository.saveDietPlan(userId, singleFoodPlan, "single-food", {
    week: "current",
  });
  await repository.saveDietPlan(userId, recipePlan, "recipes", {
    week: "current",
    activateDietType: false,
  });

  assert.equal(await getUserDietType(userId), "single-food");
  assert.equal(await getDietWeekCount("user_diet_plan", userId, "current"), 7);
  assert.equal(await getDietWeekCount("user_recipe_plan", userId, "current"), 7);

  const storedRecipePlan = await repository.getDietPlan(userId, {
    dietType: "recipes",
    week: "current",
  });

  assert.equal(storedRecipePlan?.days[0]?.breakfast.object, recipePlan.days[0].breakfast.object);
});

test("diet and workout plan rows persist ids and completion flags", async (t) => {
  const userId = randomUUID();
  t.after(async () => {
    await mysqlPool.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [userId]);
  });

  await createUser(userId);

  await repository.saveDietPlan(userId, buildSingleFoodPlan(), "single-food", {
    week: "current",
  });
  await repository.saveDietPlan(userId, buildRecipePlan(), "recipes", {
    week: "current",
    activateDietType: false,
  });
  await repository.saveWorkoutPlan(userId, buildWorkoutPlan());

  const initialDietRow = await getDietRowState("user_diet_plan", userId, "current", 1);
  const initialWorkoutRow = await getWorkoutRowState(userId, 1);

  assert.ok(initialDietRow?.id);
  assert.equal(Boolean(initialDietRow?.breakfast_eaten), false);
  assert.equal(Boolean(initialDietRow?.lunch_eaten), false);
  assert.ok(initialWorkoutRow?.id);
  assert.equal(Boolean(initialWorkoutRow?.complete), false);

  await repository.syncDietPlanMealEatenState(userId, "single-food", 1, "breakfast", true, "current");
  await repository.syncWorkoutPlanDayCompletionState(userId, 1, true);

  const updatedDietRow = await getDietRowState("user_diet_plan", userId, "current", 1);
  const untouchedRecipeRow = await getDietRowState("user_recipe_plan", userId, "current", 1);
  const updatedWorkoutRow = await getWorkoutRowState(userId, 1);
  const updatedWorkoutPlan = await repository.getWorkoutPlan(userId);

  assert.equal(Boolean(updatedDietRow?.breakfast_eaten), true);
  assert.equal(Boolean(updatedDietRow?.lunch_eaten), false);
  assert.equal(Boolean(untouchedRecipeRow?.breakfast_eaten), false);
  assert.equal(Boolean(updatedWorkoutRow?.complete), true);
  assert.equal(updatedWorkoutPlan?.days[0]?.completed, true);
  assert.equal(updatedWorkoutPlan?.days[1]?.completed, false);

  await repository.syncDietPlanMealEatenState(userId, "single-food", 1, "breakfast", false, "current");
  await repository.syncWorkoutPlanDayCompletionState(userId, 1, false);

  const resetDietRow = await getDietRowState("user_diet_plan", userId, "current", 1);
  const resetWorkoutRow = await getWorkoutRowState(userId, 1);
  const resetWorkoutPlan = await repository.getWorkoutPlan(userId);

  assert.equal(Boolean(resetDietRow?.breakfast_eaten), false);
  assert.equal(Boolean(resetWorkoutRow?.complete), false);
  assert.equal(resetWorkoutPlan?.days[0]?.completed, false);
});

test("progress tracking rows persist ids", async (t) => {
  const userId = randomUUID();
  t.after(async () => {
    await mysqlPool.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [userId]);
  });

  await createUser(userId);

  await repository.saveUserProgressDay({
    userId,
    date: "2026-03-02",
    planDayNumber: 1,
    planDayName: "Monday",
    targets: {
      calories: 2400,
      kilojoules: 10042,
    },
    meals: {
      breakfast: {
        completed: true,
        completedAt: "2026-03-02T08:00:00.000Z",
        calories: 320,
        kilojoules: 1339,
        proteinGrams: 30,
        carbsGrams: 20,
        fatsGrams: 10,
      },
      snack1: {
        completed: false,
        completedAt: null,
        calories: 0,
        kilojoules: 0,
        proteinGrams: 0,
        carbsGrams: 0,
        fatsGrams: 0,
      },
      lunch: {
        completed: false,
        completedAt: null,
        calories: 0,
        kilojoules: 0,
        proteinGrams: 0,
        carbsGrams: 0,
        fatsGrams: 0,
      },
      dinner: {
        completed: false,
        completedAt: null,
        calories: 0,
        kilojoules: 0,
        proteinGrams: 0,
        carbsGrams: 0,
        fatsGrams: 0,
      },
      snack2: {
        completed: false,
        completedAt: null,
        calories: 0,
        kilojoules: 0,
        proteinGrams: 0,
        carbsGrams: 0,
        fatsGrams: 0,
      },
      supplements: {
        completed: false,
        completedAt: null,
        calories: 0,
        kilojoules: 0,
        proteinGrams: 0,
        carbsGrams: 0,
        fatsGrams: 0,
      },
    },
    workout: {
      completed: false,
      completedAt: null,
      caloriesBurned: 0,
      kilojoulesBurned: 0,
    },
    macroTotals: {
      proteinGrams: 30,
      carbsGrams: 20,
      fatsGrams: 10,
    },
    totals: {
      caloriesConsumed: 320,
      kilojoulesConsumed: 1339,
      caloriesBurned: 0,
      kilojoulesBurned: 0,
      netCalories: 320,
      netKilojoules: 1339,
      calorieDeltaFromTarget: -2080,
      kilojouleDeltaFromTarget: -8703,
      mealsCompleted: 1,
      workoutsCompleted: 0,
    },
  });

  const trackedRow = await getProgressTrackingRowState(userId, "2026-03-02");
  assert.ok(trackedRow?.id);
});

test("daily tracking entries and exercise logs persist, update, and clear", async (t) => {
  const userId = randomUUID();
  t.after(async () => {
    await mysqlPool.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [userId]);
  });

  await createUser(userId);

  const initialTrackingEntry: UserTrackingEntry = {
    userId,
    date: "2026-03-02",
    kjsConsumed: 1590,
    macrosConsumed: {
      proteinGrams: 30,
      carbsGrams: 35,
      fatsGrams: 12,
    },
    kjsTarget: 8452,
    macrosTarget: {
      proteinGrams: 165,
      carbsGrams: 175,
      fatsGrams: 60,
    },
    kjsBurned: 0,
    kjsBurnedTarget: 1464,
  };

  await repository.saveUserTrackingEntry(initialTrackingEntry);
  await repository.saveUserTrackingEntry({
    ...initialTrackingEntry,
    kjsConsumed: 2469,
    macrosConsumed: {
      proteinGrams: 50,
      carbsGrams: 57,
      fatsGrams: 16,
    },
    kjsBurned: 1464,
  });

  const exerciseLogs: UserExerciseLogInput[] = [
    {
      exerciseName: "Goblet Squat",
      setsCompleted: 3,
      repsCompleted: 10,
      weightUsed: 24.5,
    },
    {
      exerciseName: "Push Press",
      setsCompleted: 4,
      repsCompleted: 8,
      weightUsed: 32.5,
    },
  ];

  await repository.replaceUserExerciseLogs(userId, "2026-03-02", exerciseLogs);

  const trackingRow = await getTrackingRowState(userId, "2026-03-02");
  assert.equal(trackingRow?.kjs_consumed, 2469);
  assert.equal(trackingRow?.kjs_target, 8452);
  assert.deepEqual(parseJsonColumn(trackingRow?.macros_consumed ?? "{}"), {
    proteinGrams: 50,
    carbsGrams: 57,
    fatsGrams: 16,
  });
  assert.deepEqual(parseJsonColumn(trackingRow?.macros_target ?? "{}"), {
    proteinGrams: 165,
    carbsGrams: 175,
    fatsGrams: 60,
  });
  assert.equal(trackingRow?.kjs_burned, 1464);
  assert.equal(trackingRow?.kjs_burned_target, 1464);

  const storedTrackingEntries = await repository.listUserTrackingEntries(
    userId,
    "2026-03-01",
    "2026-03-07",
  );
  assert.equal(storedTrackingEntries.length, 1);
  assert.equal(storedTrackingEntries[0].kjsConsumed, 2469);
  assert.deepEqual(storedTrackingEntries[0].macrosConsumed, {
    proteinGrams: 50,
    carbsGrams: 57,
    fatsGrams: 16,
  });

  const exerciseLogRows = await getExerciseLogRows(userId, "2026-03-02");
  assert.equal(exerciseLogRows.length, 2);
  assert.equal(exerciseLogRows[0].exercise_name, "Goblet Squat");
  assert.equal(Number(exerciseLogRows[0].weight_used), 24.5);
  assert.equal(Number(exerciseLogRows[0].volume), 735);
  assert.equal(Number(exerciseLogRows[1].volume), 1040);

  const storedExerciseLogs = await repository.listUserExerciseLogs(
    userId,
    "2026-03-01",
    "2026-03-07",
  );
  assert.equal(storedExerciseLogs.length, 2);
  assert.equal(storedExerciseLogs[1].exerciseName, "Push Press");
  assert.equal(storedExerciseLogs[1].volume, 1040);

  await repository.replaceUserExerciseLogs(userId, "2026-03-02", []);
  const clearedExerciseLogRows = await getExerciseLogRows(userId, "2026-03-02");
  assert.equal(clearedExerciseLogRows.length, 0);
});

test("daily water entries persist and list back by date range", async (t) => {
  const userId = randomUUID();
  t.after(async () => {
    await mysqlPool.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [userId]);
  });

  await createUser(userId);

  const waterEntry: UserWaterEntry = {
    userId,
    date: "2026-03-02",
    targetLiters: 3.9,
    targetGlasses: 4,
    glassesCompleted: 3,
    litersPerGlass: 1,
    completedLiters: 3,
  };

  await repository.saveUserWaterEntry(waterEntry);
  await repository.saveUserWaterEntry({
    ...waterEntry,
    glassesCompleted: 4,
    completedLiters: 4,
  });

  const waterRow = await getWaterRowState(userId, "2026-03-02");
  assert.equal(Number(waterRow?.target_liters), 3.9);
  assert.equal(waterRow?.target_glasses, 4);
  assert.equal(waterRow?.glasses_completed, 4);
  assert.equal(Number(waterRow?.liters_per_glass), 1);

  const storedWaterEntries = await repository.listUserWaterEntries(
    userId,
    "2026-03-01",
    "2026-03-07",
  );
  assert.equal(storedWaterEntries.length, 1);
  assert.equal(storedWaterEntries[0].targetGlasses, 4);
  assert.equal(storedWaterEntries[0].glassesCompleted, 4);
  assert.equal(storedWaterEntries[0].completedLiters, 4);
});

test("shopping lists persist independently by diet type and week", async (t) => {
  const userId = randomUUID();
  t.after(async () => {
    await mysqlPool.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [userId]);
  });

  await createUser(userId);

  const recipeCurrentShopping = buildShoppingList("recipe-current");
  const recipeNextShopping = buildShoppingList("recipe-next");
  const singleFoodCurrentShopping = buildShoppingList("single-current");

  await repository.saveShoppingList(userId, recipeCurrentShopping, "recipes", "current");
  await repository.saveShoppingList(userId, recipeNextShopping, "recipes", "next");
  await repository.saveShoppingList(userId, singleFoodCurrentShopping, "single-food", "current");

  assert.equal(await getShoppingWeekCount("shopping_market_recipes_list", userId, "current"), 1);
  assert.equal(await getShoppingWeekCount("shopping_market_recipes_list", userId, "next"), 1);
  assert.equal(await getShoppingWeekCount("shopping_market_single_food_list", userId, "current"), 1);

  const storedRecipeNext = await repository.getShoppingList(userId, {
    dietType: "recipes",
    week: "next",
  });
  const storedSingleFoodCurrent = await repository.getShoppingList(userId, {
    dietType: "single-food",
    week: "current",
  });

  assert.equal(storedRecipeNext?.categories.proteins[0]?.item, "recipe-next chicken");
  assert.equal(storedSingleFoodCurrent?.categories.proteins[0]?.item, "single-current chicken");
});
