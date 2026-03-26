import test from "node:test";
import assert from "node:assert/strict";
import {
  buildShoppingPrompt,
  generateRecipeShoppingListFromIngredients,
} from "../../src/api/shoppingListGenerator";
import { DietPlan } from "../../src/types";

const dayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const buildRecipePlan = (): DietPlan => ({
  summary: {
    dailyCalories: 2300,
    macros: {
      protein: "200g",
      carbs: "180g",
      fats: "80g",
    },
    cuisines: ["international"],
  },
  days: Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    dayName: dayNames[index],
    breakfast: {
      object: "Savory eggs",
      description: "Eggs with feta and spinach.",
      quantity: 300,
      quantityUnit: "g",
      ingredients: [
        { item: "Eggs", quantity: 3, quantityUnit: "g" },
        { item: "Feta cheese", quantity: 40, quantityUnit: "g" },
        { item: "Spinach", quantity: 60, quantityUnit: "g" },
      ],
      macros: {
        protein: "30g",
        carbs: "8g",
        fats: "18g",
      },
      calories: 360,
      kilojoules: 1506,
    },
    snack1: {
      object: "Yogurt bowl",
      description: "Greek yogurt snack.",
      quantity: 200,
      quantityUnit: "g",
      ingredients: [
        { item: "Greek yogurt", quantity: 150, quantityUnit: "g" },
        { item: "Berries", quantity: 50, quantityUnit: "g" },
      ],
      macros: {
        protein: "18g",
        carbs: "12g",
        fats: "4g",
      },
      calories: 180,
      kilojoules: 753,
    },
    lunch: {
      object: "Chicken bowl",
      description: "Chicken with rice and broccoli.",
      quantity: 450,
      quantityUnit: "g",
      ingredients: [
        { item: "Chicken breast", quantity: 180, quantityUnit: "g" },
        { item: "Rice", quantity: 150, quantityUnit: "g" },
        { item: "Broccoli", quantity: 120, quantityUnit: "g" },
        { item: "Olive oil", quantity: 10, quantityUnit: "ml" },
      ],
      macros: {
        protein: "42g",
        carbs: "45g",
        fats: "12g",
      },
      calories: 520,
      kilojoules: 2176,
    },
    dinner: {
      object: "Salmon pasta",
      description: "Salmon with pasta and parmesan.",
      quantity: 480,
      quantityUnit: "g",
      ingredients: [
        { item: "Salmon fillet", quantity: 180, quantityUnit: "g" },
        { item: "Whole wheat spaghetti", quantity: 120, quantityUnit: "g" },
        { item: "Tomatoes", quantity: 100, quantityUnit: "g" },
        { item: "Parmesan cheese", quantity: 30, quantityUnit: "g" },
      ],
      macros: {
        protein: "40g",
        carbs: "40g",
        fats: "18g",
      },
      calories: 540,
      kilojoules: 2259,
    },
    snack2: {
      object: "Protein shake",
      description: "Recovery shake.",
      quantity: 300,
      quantityUnit: "ml",
      ingredients: [
        { item: "Water", quantity: 250, quantityUnit: "ml" },
        { item: "Whey protein powder", quantity: 30, quantityUnit: "g" },
      ],
      macros: {
        protein: "24g",
        carbs: "2g",
        fats: "1g",
      },
      calories: 130,
      kilojoules: 544,
    },
    supplements: [
      {
        object: "Creatine",
        description: "Daily creatine.",
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

test("recipe shopping list builds categories and prices from ingredients", () => {
  const shoppingList = generateRecipeShoppingListFromIngredients(buildRecipePlan());

  assert.ok(shoppingList.metadata.estimatedCostAudByStore);
  assert.ok(shoppingList.metadata.estimatedCostAudByStore.aldi > 0);
  assert.ok(shoppingList.metadata.estimatedCostAudByStore.coles > 0);
  assert.ok(shoppingList.metadata.estimatedCostAudByStore.woolworths > 0);

  assert.ok(shoppingList.categories.proteins.some((item) => item.item === "Chicken breast"));
  assert.ok(shoppingList.categories.proteins.some((item) => item.item === "Salmon fillet"));
  assert.ok(shoppingList.categories.dairy.some((item) => item.item === "Feta cheese"));
  assert.ok(shoppingList.categories.dairy.some((item) => item.item === "Greek yogurt"));
  assert.ok(shoppingList.categories.pantry.some((item) => item.item === "Rice"));
  assert.ok(shoppingList.categories.pantry.some((item) => item.item === "Olive oil"));
  assert.ok(shoppingList.categories.produce.some((item) => item.item === "Spinach"));
  assert.ok(shoppingList.categories.beverages.some((item) => item.item === "Water"));

  assert.ok(shoppingList.byStoreSection.some((section) => section.section === "Meat & Seafood"));
  assert.ok(shoppingList.byStoreSection.some((section) => section.section === "Dairy & Eggs"));
  assert.ok(shoppingList.byStoreSection.some((section) => section.section === "Pantry"));
});

test("recipe shopping prompt requires ingredient-based shopping rows", () => {
  const prompt = buildShoppingPrompt(buildRecipePlan(), "recipes");

  assert.match(prompt, /ingredients" array as the source of truth/i);
  assert.match(prompt, /do not return recipe names or meal titles as shopping items/i);
  assert.match(prompt, /combine duplicate ingredients across all days/i);
  assert.match(prompt, /without currency symbols/i);
});
