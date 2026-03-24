import test from "node:test";
import assert from "node:assert/strict";
import { DataUserCommand, DietPlan } from "../../src/types";
import {
  applyMealCountToDietPlan,
  createEmptyDietEntry,
  executeDietPlanGeneration,
  resolveActiveDietMealSlots,
  validateDietPlanResponse,
} from "../../src/api/dietPlanGenerationShared";

const dayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const buildEntry = (options?: {
  instructions?: string[];
  preparationTimeMinutes?: number;
  ingredients?: Array<{ item: string; quantity: number; quantityUnit: string }>;
}): DietPlan["days"][number]["breakfast"] => ({
  object: "Lemon Chicken Bowl",
  description: "High-protein balanced meal.",
  quantity: 350,
  quantityUnit: "g",
  ingredients: options?.ingredients ?? [
    { item: "Chicken breast", quantity: 150, quantityUnit: "g" },
    { item: "Rice", quantity: 120, quantityUnit: "g" },
    { item: "Spinach", quantity: 80, quantityUnit: "g" },
  ],
  instructions: options?.instructions,
  preparationTimeMinutes: options?.preparationTimeMinutes,
  macros: {
    protein: "35g",
    carbs: "30g",
    fats: "10g",
  },
  calories: 420,
  kilojoules: 1757,
});

const buildPlan = (
  entryFactory: () => DietPlan["days"][number]["breakfast"],
): DietPlan => ({
  summary: {
    dailyCalories: 2300,
    macros: {
      protein: "180g",
      carbs: "210g",
      fats: "70g",
    },
    cuisines: ["mediterranean"],
  },
  days: Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    dayName: dayNames[index],
    breakfast: entryFactory(),
    snack1: entryFactory(),
    lunch: entryFactory(),
    dinner: entryFactory(),
    snack2: entryFactory(),
    supplements: [],
  })),
});

const sampleUser: DataUserCommand = {
  id: "user-1",
  name: "Recipe Tester",
  age: 31,
  gender: "male",
  weight: 82,
  height: 178,
  goal: "fat-loss",
  diet: "omnivore",
  kindOfDiet: "recipes",
  energyUnitPreference: "kj",
  avoidedFoods: [],
  allergies: [],
  levelActivity: "moderate",
  trainLocation: "gym",
  timeToTrain: 60,
  numberOfMeals: 4,
  caloriesTarget: 2300,
  kilojoulesTarget: 9623,
  proteinTarget: 180,
  carbsTarget: 210,
  fatsTarget: 70,
  injuries: [],
  favoriteFoods: [],
  supplementation: [],
  favorieteCoucineRecipes: ["mediterranean"],
  isPro: false,
};

test("single-food validation accepts entries without instructions", () => {
  const plan = buildPlan(() => buildEntry());

  assert.doesNotThrow(() => {
    validateDietPlanResponse({ dietPlan: plan }, "single-food");
  });
});

test("recipe validation rejects entries without instructions", () => {
  const plan = buildPlan(() => buildEntry());

  assert.throws(() => {
    validateDietPlanResponse({ dietPlan: plan }, "recipes");
  }, /Invalid diet plan structure received from API/);
});

test("recipe validation accepts entries with instructions and prep time", () => {
  const plan = buildPlan(() => buildEntry({
    instructions: ["Prep the ingredients.", "Cook and plate the meal."],
    preparationTimeMinutes: 20,
  }));

  assert.doesNotThrow(() => {
    validateDietPlanResponse({ dietPlan: plan }, "recipes");
  });
});

test("generation retries after a truncated recipe JSON response", async () => {
  const recipePlan = buildPlan(() => buildEntry({
    instructions: ["Prep the ingredients.", "Cook and plate the meal."],
    preparationTimeMinutes: 20,
  }));
  const responses = [
    {
      choices: [
        {
          finish_reason: "length",
          message: {
            content: "{\"dietPlan\":",
          },
        },
      ],
    },
    {
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({ dietPlan: recipePlan }),
          },
        },
      ],
    },
  ];
  let callCount = 0;
  const capturedFormats: unknown[] = [];

  const result = await executeDietPlanGeneration(
    sampleUser,
    "recipes",
    [
      { label: "attempt-1", prompt: "first", temperature: 0.3 },
      { label: "attempt-2", prompt: "second", temperature: 0.2 },
    ],
    {
      systemPrompt: "nutritionist",
      client: {
        chat: {
          completions: {
            create: async (request) => {
              capturedFormats.push(request.response_format);
              const response = responses[callCount];
              callCount += 1;
              return response;
            },
          },
        },
      },
    },
  );

  assert.equal(callCount, 2);
  assert.equal(result.data.days.length, 7);
  assert.equal(result.metadata?.attempt, "attempt-2");
  assert.equal((capturedFormats[0] as { type: string }).type, "json_schema");
});

test("generation retries when custom diet-plan validation fails", async () => {
  const singleFoodPlan = buildPlan(() => buildEntry());
  const responses = [
    {
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({ dietPlan: singleFoodPlan }),
          },
        },
      ],
    },
    {
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({ dietPlan: singleFoodPlan }),
          },
        },
      ],
    },
  ];
  let callCount = 0;
  let validationCount = 0;

  const result = await executeDietPlanGeneration(
    sampleUser,
    "single-food",
    [
      { label: "attempt-1", prompt: "first", temperature: 0.3 },
      { label: "attempt-2", prompt: "second", temperature: 0.2 },
    ],
    {
      systemPrompt: "nutritionist",
      validatePlan: () => {
        validationCount += 1;

        if (validationCount === 1) {
          throw new Error("supplements missing");
        }
      },
      client: {
        chat: {
          completions: {
            create: async () => {
              const response = responses[callCount];
              callCount += 1;
              return response;
            },
          },
        },
      },
    },
  );

  assert.equal(callCount, 2);
  assert.equal(validationCount, 2);
  assert.equal(result.metadata?.attempt, "attempt-2");
  assert.equal(result.data.days.length, 7);
});

test("meal-count helpers keep only the requested two meal slots populated", () => {
  const plan = buildPlan(() => buildEntry());
  const normalizedPlan = applyMealCountToDietPlan(plan, 2);
  const [firstDay] = normalizedPlan.days;

  assert.deepEqual(resolveActiveDietMealSlots(2), ["lunch", "dinner"]);
  assert.deepEqual(firstDay.breakfast, createEmptyDietEntry());
  assert.deepEqual(firstDay.snack1, createEmptyDietEntry());
  assert.notDeepEqual(firstDay.lunch, createEmptyDietEntry());
  assert.notDeepEqual(firstDay.dinner, createEmptyDietEntry());
  assert.deepEqual(firstDay.snack2, createEmptyDietEntry());
});
