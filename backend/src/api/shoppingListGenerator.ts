import { createOpenAIClient, MODEL, SHOPPING_LIST_MAX_TOKENS } from "./client";
import { isEmptyDietEntry } from "./dietPlanGenerationShared";
import { SkillLoader } from "../utils/skillLoader";
import {
  DietPlan,
  ShoppingItem,
  ShoppingList,
  ApiResponse,
  DietType,
  ShoppingStoreSection,
} from "../types";

type ShoppingCategory = keyof ShoppingList["categories"];

interface RawShoppingItem {
  item?: string;
  name?: string;
  quantity?: number | string;
  quantityUnit?: string;
  category?: string;
  storeSection?: string;
  shelfLife?: string;
  isBulk?: boolean;
  isPantryStaple?: boolean;
}

interface RawShoppingStoreSection {
  section?: string;
  items?: RawShoppingItem[];
}

interface RawShoppingList {
  metadata?: ShoppingList["metadata"];
  categories?: Partial<Record<ShoppingCategory, RawShoppingItem[]>>;
  byStoreSection?: RawShoppingStoreSection[];
  mealPrepStrategy?: ShoppingList["mealPrepStrategy"];
  pantryChecklist?: string[];
  costOptimizations?: unknown[];
}

const shoppingCategories: ShoppingCategory[] = [
  "proteins",
  "produce",
  "pantry",
  "dairy",
  "frozen",
  "beverages",
];

const australianStores: Array<keyof NonNullable<ShoppingList["metadata"]["estimatedCostAudByStore"]>> = [
  "coles",
  "woolworths",
  "aldi",
];

const liquidKeywords = [
  "milk",
  "water",
  "juice",
  "broth",
  "stock",
  "drink",
  "smoothie",
  "coffee",
  "tea",
  "yogurt drink",
];

const isShoppingRelevantDietEntry = (entry: DietPlan["days"][number]["breakfast"]): boolean => (
  !isEmptyDietEntry(entry)
);

const extractQuantityValue = (value: number | string | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

const coercePrice = (value: number | string | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? Math.round(parsedValue) : 0;
};

const extractQuantityUnit = (value: RawShoppingItem): string => {
  if (typeof value.quantityUnit === "string" && value.quantityUnit.trim().length > 0) {
    return value.quantityUnit.trim();
  }

  if (typeof value.quantity === "string") {
    const match = value.quantity.match(/[a-zA-Z]+$/);
    if (match) {
      return match[0];
    }
  }

  return "";
};

const isLikelyLiquid = (itemName: string): boolean => {
  const lowerItemName = itemName.toLowerCase();
  return liquidKeywords.some((keyword) => lowerItemName.includes(keyword));
};

const resolveCategoryFromSection = (sectionName: string): ShoppingCategory => {
  const lowerSectionName = sectionName.toLowerCase();

  if (lowerSectionName.includes("protein")) {
    return "proteins";
  }

  if (lowerSectionName.includes("produce")) {
    return "produce";
  }

  if (lowerSectionName.includes("dairy")) {
    return "dairy";
  }

  if (lowerSectionName.includes("frozen")) {
    return "frozen";
  }

  if (lowerSectionName.includes("beverage")) {
    return "beverages";
  }

  return "pantry";
};

const normaliseQuantity = (
  quantity: number,
  unit: string,
  itemName: string,
): { quantity: number; quantityUnit: string } => {
  const normalizedUnit = unit.trim().toLowerCase();

  if (["g", "gr", "gram", "grams"].includes(normalizedUnit)) {
    return { quantity: Math.round(quantity), quantityUnit: "gr" };
  }

  if (["kg", "kilogram", "kilograms"].includes(normalizedUnit)) {
    return { quantity: Math.round(quantity * 1000), quantityUnit: "gr" };
  }

  if (["ml", "milliliter", "milliliters"].includes(normalizedUnit)) {
    return { quantity: Math.round(quantity), quantityUnit: "ml" };
  }

  if (["l", "lt", "liter", "liters"].includes(normalizedUnit)) {
    return { quantity: Math.round(quantity * 1000), quantityUnit: "ml" };
  }

  return {
    quantity: Math.round(quantity),
    quantityUnit: isLikelyLiquid(itemName) ? "ml" : "gr",
  };
};

const normaliseShoppingItem = (
  item: RawShoppingItem,
  fallbackCategory: ShoppingCategory,
): ShoppingItem => {
  const itemName = (item.item ?? item.name ?? "").trim();
  const quantity = extractQuantityValue(item.quantity);
  const quantityUnit = extractQuantityUnit(item);
  const normalizedQuantity = normaliseQuantity(quantity, quantityUnit, itemName);

  return {
    item: itemName,
    quantity: normalizedQuantity.quantity,
    quantityUnit: normalizedQuantity.quantityUnit,
    category: item.category ?? fallbackCategory,
    storeSection: item.storeSection,
    shelfLife: item.shelfLife,
    isBulk: item.isBulk,
    isPantryStaple: item.isPantryStaple,
  };
};

const buildShoppingItemFromIngredient = (
  ingredient: { quantity: number; unit: string } | undefined,
  itemName: string,
  category: ShoppingCategory,
  storeSection: string,
  shelfLife: string,
  isBulk: boolean,
  isPantryStaple: boolean,
): ShoppingItem => {
  const normalizedQuantity = normaliseQuantity(
    ingredient?.quantity ?? 0,
    ingredient?.unit ?? "g",
    itemName,
  );

  return {
    item: itemName,
    quantity: normalizedQuantity.quantity,
    quantityUnit: normalizedQuantity.quantityUnit,
    category,
    storeSection,
    shelfLife,
    isBulk,
    isPantryStaple,
  };
};

const normaliseShoppingList = (rawShoppingList: RawShoppingList): ShoppingList => {
  const estimatedCostAudByStore = australianStores.reduce<NonNullable<ShoppingList["metadata"]["estimatedCostAudByStore"]>>(
    (storePrices, storeName) => ({
      ...storePrices,
      [storeName]: coercePrice(rawShoppingList.metadata?.estimatedCostAudByStore?.[storeName]),
    }),
    {
      coles: 0,
      woolworths: 0,
      aldi: 0,
    },
  );
  const cheapestStoreEntry = (Object.entries(estimatedCostAudByStore) as Array<[
    keyof typeof estimatedCostAudByStore,
    number,
  ]>)
    .filter(([, price]) => price > 0)
    .sort((left, right) => left[1] - right[1])[0];
  const recommendedStore = rawShoppingList.metadata?.recommendedStore
    ?? (cheapestStoreEntry
      ? ({
        coles: "Coles",
        woolworths: "Woolworths",
        aldi: "Aldi",
      } as const)[cheapestStoreEntry[0]]
      : "Aldi");

  const categories = shoppingCategories.reduce<ShoppingList["categories"]>(
    (currentCategories, categoryName) => ({
      ...currentCategories,
      [categoryName]: (rawShoppingList.categories?.[categoryName] ?? [])
        .map((item) => normaliseShoppingItem(item, categoryName))
        .filter((item) => item.item.length > 0 && item.quantity > 0),
    }),
    {
      proteins: [],
      produce: [],
      pantry: [],
      dairy: [],
      frozen: [],
      beverages: [],
    },
  );

  const byStoreSection = (rawShoppingList.byStoreSection ?? [])
    .map<ShoppingStoreSection>((section) => ({
      section: section.section ?? "General",
      items: (section.items ?? [])
        .map((item) => normaliseShoppingItem(
          item,
          resolveCategoryFromSection(section.section ?? "General"),
        ))
        .filter((item) => item.item.length > 0 && item.quantity > 0),
    }))
    .filter((section) => section.items.length > 0);

  return {
    metadata: {
      totalItems: rawShoppingList.metadata?.totalItems ?? 0,
      estimatedCost: coercePrice(rawShoppingList.metadata?.estimatedCost)
        || cheapestStoreEntry?.[1]
        || 0,
      estimatedCostAudByStore,
      recommendedStore,
      currency: "AUD",
      storeSections: rawShoppingList.metadata?.storeSections ?? byStoreSection.length,
      prepTime: rawShoppingList.metadata?.prepTime ?? "1 hour",
      daysCovered: 7,
    },
    categories,
    byStoreSection,
    mealPrepStrategy: rawShoppingList.mealPrepStrategy ?? {
      batchCookItems: [],
      prepOrder: [],
      storageInstructions: [],
      equipmentNeeded: [],
    },
    pantryChecklist: rawShoppingList.pantryChecklist ?? [],
    costOptimizations: rawShoppingList.costOptimizations ?? [],
  };
};

/**
 * Generates a comprehensive shopping list from a 7-day diet plan
 */
export async function generateShoppingList(
  dietPlan: DietPlan,
  userId: string,
  dietType: DietType,
): Promise<ApiResponse<ShoppingList>> {
  const client = createOpenAIClient();
  
  const systemPrompt: string = SkillLoader.load("shopper");
  const userPrompt: string = buildShoppingPrompt(dietPlan, dietType);

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 1,
      max_tokens: SHOPPING_LIST_MAX_TOKENS,
      response_format: { type: "json_object" }
    });

    const responseContent: string | null = completion.choices[0].message.content;
    
    if (!responseContent) {
      throw new Error("Empty response from API");
    }

    const response: { shoppingList: RawShoppingList } = JSON.parse(responseContent);
    const shoppingList = normaliseShoppingList(response.shoppingList ?? {});

    if (shoppingList.metadata.totalItems === 0) {
      throw new Error("Invalid shopping list structure received from API");
    }

    return {
      success: true,
      data: shoppingList,
      metadata: {
        userId: userId,
        dietPlanCalories: dietPlan.summary.dailyCalories,
        generatedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error("Shopping List Generation Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to generate shopping list: ${errorMessage}`);
  }
}

/**
 * Builds shopping prompt from diet plan
 */
function buildShoppingPrompt(dietPlan: DietPlan, dietType: DietType): string {
  const mealSummary = dietPlan.days.map(day => ({
    day: day.day,
    dayName: day.dayName,
    meals: [
      { name: "Breakfast", entry: day.breakfast },
      { name: "Snack 1", entry: day.snack1 },
      { name: "Lunch", entry: day.lunch },
      { name: "Dinner", entry: day.dinner },
      { name: "Snack 2", entry: day.snack2 },
    ]
      .filter((meal) => isShoppingRelevantDietEntry(meal.entry))
      .map((meal) => ({
        name: meal.name,
        object: meal.entry.object,
        description: meal.entry.description,
        quantity: `${meal.entry.quantity} ${meal.entry.quantityUnit}`,
        ingredients: meal.entry.ingredients,
      })),
    supplements: day.supplements.map((supplement) => ({
      object: supplement.object,
      description: supplement.description,
      quantity: `${supplement.quantity} ${supplement.quantityUnit}`,
      ingredients: supplement.ingredients,
    })),
  }));

  const cuisineTypes = dietPlan.summary.cuisines.join(", ");

  return `Generate a comprehensive shopping list for this 7-day ${dietType} diet plan.

PLAN OVERVIEW:
- Daily Calories: ${dietPlan.summary.dailyCalories}
- Macronutrients: Protein ${dietPlan.summary.macros.protein}, Carbs ${dietPlan.summary.macros.carbs}, Fats ${dietPlan.summary.macros.fats}
- Cuisines: ${cuisineTypes}
- Diet Type: ${dietType}

7-DAY MEAL SUMMARY:
${JSON.stringify(mealSummary, null, 2)}

TASK:
1. Extract every ingredient needed for all 7 days
2. Calculate exact quantities (add 10% buffer for produce)
3. Categorize by: proteins, produce, pantry, dairy, frozen, beverages
4. Organize by store section for efficient shopping
5. Identify batch cook opportunities
6. Suggest meal prep order and storage
7. Note pantry staples user likely already has
8. Suggest cost optimizations
9. Estimate the basket total in Australian dollars for Coles, Woolworths, and Aldi

Return the complete shopping list with all categories, quantities, and strategies.

Return ONLY valid JSON with this exact top-level structure:
{
  "shoppingList": {
    "metadata": {
      "totalItems": number,
      "estimatedCost": number,
      "estimatedCostAudByStore": {
        "coles": number,
        "woolworths": number,
        "aldi": number
      },
      "recommendedStore": "Coles" | "Woolworths" | "Aldi",
      "currency": "AUD",
      "storeSections": number,
      "prepTime": string
    },
    "categories": {
      "proteins": [
        {
          "item": string,
          "quantity": number,
          "quantityUnit": "gr" | "ml",
          "storeSection": string,
          "shelfLife": string,
          "isBulk": boolean,
          "isPantryStaple": boolean
        }
      ],
      "produce": [],
      "pantry": [],
      "dairy": [],
      "frozen": [],
      "beverages": []
    },
    "byStoreSection": [
      {
        "section": string,
        "items": [
          {
            "item": string,
            "quantity": number,
            "quantityUnit": "gr" | "ml"
          }
        ]
      }
    ],
    "mealPrepStrategy": {
      "batchCookItems": string[],
      "prepOrder": string[],
      "storageInstructions": [],
      "equipmentNeeded": string[]
    },
    "pantryChecklist": string[],
    "costOptimizations": []
  }
}`;
}

/**
 * Fallback: Generate basic shopping list from extracted ingredients
 */
export function generateBasicShoppingList(dietPlan: DietPlan): ShoppingList {
  console.log("🔄 Generating basic shopping list from diet plan...");
  
  const aggregatedIngredients = new Map<string, { quantity: number; unit: string }>();
  dietPlan.days.forEach(day => {
    [
      day.breakfast,
      day.snack1,
      day.lunch,
      day.dinner,
      day.snack2,
      ...day.supplements,
    ].filter((entry) => isShoppingRelevantDietEntry(entry)).forEach((entry) => {
      entry.ingredients.forEach((ingredient) => {
        const current = aggregatedIngredients.get(ingredient.item);
        if (!current || current.unit !== ingredient.quantityUnit) {
          aggregatedIngredients.set(ingredient.item, {
            quantity: ingredient.quantity,
            unit: ingredient.quantityUnit,
          });
          return;
        }

        aggregatedIngredients.set(ingredient.item, {
          quantity: current.quantity + ingredient.quantity,
          unit: current.unit,
        });
      });
    });
  });

  const proteins: string[] = [];
  const produce: string[] = [];
  const pantry: string[] = [];

  aggregatedIngredients.forEach((_quantity, food) => {
    const lower = food.toLowerCase();
    if (lower.includes("chicken") || lower.includes("meat") || lower.includes("fish") || lower.includes("egg")) {
      proteins.push(food);
    } else if (lower.includes("rice") || lower.includes("oil") || lower.includes("spice")) {
      pantry.push(food);
    } else {
      produce.push(food);
    }
  });

  return {
    metadata: {
      totalItems: aggregatedIngredients.size,
      estimatedCost: 0,
      estimatedCostAudByStore: {
        coles: 0,
        woolworths: 0,
        aldi: 0,
      },
      recommendedStore: "Aldi",
      currency: "AUD",
      storeSections: 3,
      prepTime: "1 hour",
      daysCovered: 7,
    },
    categories: {
      proteins: proteins.map((name) => buildShoppingItemFromIngredient(
        aggregatedIngredients.get(name),
        name,
        "proteins",
        "Meat & Seafood",
        "3-5 days",
        false,
        false,
      )),
      produce: produce.map((name) => buildShoppingItemFromIngredient(
        aggregatedIngredients.get(name),
        name,
        "produce",
        "Produce",
        "5-7 days",
        false,
        false,
      )),
      pantry: pantry.map((name) => buildShoppingItemFromIngredient(
        aggregatedIngredients.get(name),
        name,
        "pantry",
        "Pantry",
        "Long term",
        true,
        true,
      )),
      dairy: [],
      frozen: [],
      beverages: []
    },
    byStoreSection: [
      {
        section: "Proteins",
        items: proteins.map((name) => buildShoppingItemFromIngredient(
          aggregatedIngredients.get(name),
          name,
          "proteins",
          "Proteins",
          "3-5 days",
          false,
          false,
        )),
      },
      {
        section: "Produce",
        items: produce.map((name) => buildShoppingItemFromIngredient(
          aggregatedIngredients.get(name),
          name,
          "produce",
          "Produce",
          "5-7 days",
          false,
          false,
        )),
      },
      {
        section: "Pantry",
        items: pantry.map((name) => buildShoppingItemFromIngredient(
          aggregatedIngredients.get(name),
          name,
          "pantry",
          "Pantry",
          "Long term",
          true,
          true,
        )),
      },
    ].filter((section) => section.items.length > 0),
    mealPrepStrategy: {
      batchCookItems: proteins.slice(0, 2),
      prepOrder: ["Proteins", "Grains", "Vegetables"],
      storageInstructions: [],
      equipmentNeeded: ["Containers", "Labels"]
    },
    pantryChecklist: pantry,
    costOptimizations: []
  };
}
