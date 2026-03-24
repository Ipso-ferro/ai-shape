import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { MySqlRepositoryUser } from "../../domain/user/repositories/MySqlRepositoryUser";
import { mysqlPool } from "../../server/pool";
import { initializeDatabaseSchema } from "../../server/initializers/DatabaseSchemaInitializing";
import { DietPlan } from "../../src/types";

interface CountRow extends RowDataPacket {
  count: number;
}

interface UserStateRow extends RowDataPacket {
  kind_of_diet: string | null;
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

test("recipe plans persist in user_recipe_plan and load back from the repository", async (t) => {
  const userId = randomUUID();
  t.after(async () => {
    await mysqlPool.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [userId]);
  });

  await createUser(userId);
  const recipePlan = buildRecipePlan();

  await repository.saveDietPlan(userId, recipePlan, "recipes");

  assert.equal(await getUserDietType(userId), "recipes");
  assert.equal(await getCount("user_recipe_plan", userId), 7);
  assert.equal(await getCount("user_diet_plan", userId), 0);

  const storedPlan = await repository.getDietPlan(userId);

  assert.ok(storedPlan);
  const recipeBreakfast = storedPlan.days[0]?.breakfast;

  assert.equal(storedPlan.days.length, 7);
  assert.ok(recipeBreakfast?.instructions);
  assert.equal(recipeBreakfast?.instructions?.length, 2);
  assert.equal(recipeBreakfast?.preparationTimeMinutes, 12);
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
  assert.equal(await getCount("user_diet_plan", userId), 7);

  const storedPlan = await repository.getDietPlan(userId);

  assert.ok(storedPlan);
  assert.equal(storedPlan.days.length, 7);
  assert.equal(storedPlan.days[0].breakfast.object, "Egg breakfast 1");
  assert.equal(storedPlan.days[0].breakfast.instructions, undefined);
});
