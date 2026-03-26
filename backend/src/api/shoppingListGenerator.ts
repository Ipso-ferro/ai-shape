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

const recipeProteinKeywords = [
  "chicken",
  "beef",
  "turkey",
  "pork",
  "salmon",
  "tuna",
  "fish",
  "shrimp",
  "prawn",
  "lamb",
  "steak",
  "mince",
  "tenderloin",
  "fillet",
];

const recipeDairyKeywords = [
  "milk",
  "cheese",
  "feta",
  "cheddar",
  "parmesan",
  "mozzarella",
  "ricotta",
  "yogurt",
  "yoghurt",
  "butter",
  "cream",
  "egg",
  "eggs",
];

const recipePantryKeywords = [
  "rice",
  "quinoa",
  "oats",
  "granola",
  "pasta",
  "spaghetti",
  "noodle",
  "tortilla",
  "wrap",
  "bread",
  "lentil",
  "lentils",
  "bean",
  "beans",
  "chickpea",
  "chickpeas",
  "olive oil",
  "sesame oil",
  "oil",
  "soy sauce",
  "coconut milk",
  "broth",
  "stock",
  "sauce",
  "paste",
  "salsa",
  "spice",
  "seasoning",
  "salt",
  "protein powder",
  "whey",
  "creatine",
];

const recipeFrozenKeywords = [
  "frozen",
];

const recipeBeverageKeywords = [
  "water",
  "juice",
  "coffee",
  "tea",
  "drink",
];

interface RecipeIngredientProfile {
  category: ShoppingCategory;
  storeSection: string;
  shelfLife: string;
  isBulk: boolean;
  isPantryStaple: boolean;
}

interface RecipeAggregatedIngredient {
  key: string;
  item: string;
  quantity: number;
  quantityUnit: string;
  profile: RecipeIngredientProfile;
}

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

  const sanitizedValue = value.replace(/[^0-9.]+/g, "");
  const parsedValue = Number(sanitizedValue);
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

const normaliseIngredientKey = (itemName: string): string => (
  itemName.trim().toLowerCase().replace(/\s+/g, " ")
);

const matchesAnyKeyword = (value: string, keywords: string[]): boolean => (
  keywords.some((keyword) => value.includes(keyword))
);

const resolveRecipeIngredientProfile = (itemName: string): RecipeIngredientProfile => {
  const lowerItemName = itemName.toLowerCase();

  if (lowerItemName.includes("coconut milk")) {
    return {
      category: "pantry",
      storeSection: "Pantry",
      shelfLife: "Long term",
      isBulk: true,
      isPantryStaple: true,
    };
  }

  if (matchesAnyKeyword(lowerItemName, recipeFrozenKeywords)) {
    return {
      category: "frozen",
      storeSection: "Frozen",
      shelfLife: "1-3 months",
      isBulk: false,
      isPantryStaple: false,
    };
  }

  if (matchesAnyKeyword(lowerItemName, recipeBeverageKeywords)) {
    return {
      category: "beverages",
      storeSection: "Beverages",
      shelfLife: "5-7 days",
      isBulk: false,
      isPantryStaple: false,
    };
  }

  if (matchesAnyKeyword(lowerItemName, recipeDairyKeywords)) {
    return {
      category: "dairy",
      storeSection: "Dairy & Eggs",
      shelfLife: "5-7 days",
      isBulk: false,
      isPantryStaple: false,
    };
  }

  if (matchesAnyKeyword(lowerItemName, recipeProteinKeywords)) {
    return {
      category: "proteins",
      storeSection: "Meat & Seafood",
      shelfLife: "3-5 days",
      isBulk: false,
      isPantryStaple: false,
    };
  }

  if (matchesAnyKeyword(lowerItemName, recipePantryKeywords)) {
    return {
      category: "pantry",
      storeSection: "Pantry",
      shelfLife: "Long term",
      isBulk: true,
      isPantryStaple: !lowerItemName.includes("creatine") && !lowerItemName.includes("whey"),
    };
  }

  return {
    category: "produce",
    storeSection: "Produce",
    shelfLife: "5-7 days",
    isBulk: false,
    isPantryStaple: false,
  };
};

const applyRecipeQuantityBuffer = (
  quantity: number,
  category: ShoppingCategory,
): number => (
  category === "produce" ? Math.round(quantity * 1.1) : quantity
);

const estimateRecipeItemCostAud = (item: ShoppingItem): number => {
  const lowerItemName = item.item.toLowerCase();

  if (lowerItemName.includes("salmon")) {
    return Math.max(4, Math.round(item.quantity * 0.04));
  }

  if (lowerItemName.includes("beef")) {
    return Math.max(4, Math.round(item.quantity * 0.025));
  }

  if (
    lowerItemName.includes("chicken")
    || lowerItemName.includes("turkey")
    || lowerItemName.includes("pork")
  ) {
    return Math.max(4, Math.round(item.quantity * 0.015));
  }

  if (lowerItemName.includes("whey") || lowerItemName.includes("protein powder")) {
    return Math.max(4, Math.round(item.quantity * 0.03));
  }

  if (lowerItemName.includes("creatine")) {
    return Math.max(2, Math.round(item.quantity * 0.04));
  }

  if (lowerItemName.includes("olive oil") || lowerItemName.includes("sesame oil")) {
    return Math.max(2, Math.round(item.quantity * 0.03));
  }

  if (lowerItemName.includes("cheese") || lowerItemName.includes("feta") || lowerItemName.includes("parmesan")) {
    return Math.max(3, Math.round(item.quantity * 0.02));
  }

  if (lowerItemName.includes("milk")) {
    return Math.max(2, Math.round(item.quantity * 0.003));
  }

  if (lowerItemName.includes("water")) {
    return Math.max(1, Math.round(item.quantity * 0.001));
  }

  const unitRate = (() => {
    if (item.category === "proteins") {
      return 0.016;
    }

    if (item.category === "dairy") {
      return 0.013;
    }

    if (item.category === "pantry") {
      return item.quantityUnit === "ml" ? 0.01 : 0.006;
    }

    if (item.category === "beverages") {
      return 0.002;
    }

    if (item.category === "frozen") {
      return 0.01;
    }

    return item.quantityUnit === "ml" ? 0.004 : 0.008;
  })();

  return Math.max(1, Math.round(item.quantity * unitRate));
};

const buildEstimatedStorePrices = (
  items: ShoppingItem[],
): NonNullable<ShoppingList["metadata"]["estimatedCostAudByStore"]> => {
  const estimatedBaseCost = items.reduce((totalCost, item) => (
    totalCost + estimateRecipeItemCostAud(item)
  ), 0);

  return {
    coles: Math.max(1, Math.round(estimatedBaseCost)),
    woolworths: Math.max(1, Math.round(estimatedBaseCost * 1.04)),
    aldi: Math.max(1, Math.round(estimatedBaseCost * 0.92)),
  };
};

const buildRecommendedStore = (
  prices: NonNullable<ShoppingList["metadata"]["estimatedCostAudByStore"]>,
): "Coles" | "Woolworths" | "Aldi" => {
  const lowestStore = (Object.entries(prices) as Array<[keyof typeof prices, number]>)
    .sort((left, right) => left[1] - right[1])[0]?.[0];

  if (lowestStore === "coles") {
    return "Coles";
  }

  if (lowestStore === "woolworths") {
    return "Woolworths";
  }

  return "Aldi";
};

const buildRecipeShoppingItemsFromPlan = (dietPlan: DietPlan): ShoppingItem[] => {
  const aggregatedIngredients = new Map<string, RecipeAggregatedIngredient>();

  dietPlan.days.forEach((day) => {
    [
      day.breakfast,
      day.snack1,
      day.lunch,
      day.dinner,
      day.snack2,
      ...day.supplements,
    ]
      .filter((entry) => isShoppingRelevantDietEntry(entry))
      .forEach((entry) => {
        entry.ingredients.forEach((ingredient) => {
          const itemName = ingredient.item.trim();
          if (itemName.length === 0) {
            return;
          }

          const normalizedQuantity = normaliseQuantity(
            ingredient.quantity,
            ingredient.quantityUnit,
            itemName,
          );
          const profile = resolveRecipeIngredientProfile(itemName);
          const aggregateKey = `${normaliseIngredientKey(itemName)}::${normalizedQuantity.quantityUnit}`;
          const existingIngredient = aggregatedIngredients.get(aggregateKey);
          const bufferedQuantity = applyRecipeQuantityBuffer(
            normalizedQuantity.quantity,
            profile.category,
          );

          if (existingIngredient) {
            aggregatedIngredients.set(aggregateKey, {
              ...existingIngredient,
              quantity: existingIngredient.quantity + bufferedQuantity,
            });
            return;
          }

          aggregatedIngredients.set(aggregateKey, {
            key: aggregateKey,
            item: itemName,
            quantity: bufferedQuantity,
            quantityUnit: normalizedQuantity.quantityUnit,
            profile,
          });
        });
      });
  });

  return Array.from(aggregatedIngredients.values())
    .sort((left, right) => left.item.localeCompare(right.item))
    .map((ingredient) => ({
      item: ingredient.item,
      quantity: ingredient.quantity,
      quantityUnit: ingredient.quantityUnit,
      category: ingredient.profile.category,
      storeSection: ingredient.profile.storeSection,
      shelfLife: ingredient.profile.shelfLife,
      isBulk: ingredient.profile.isBulk,
      isPantryStaple: ingredient.profile.isPantryStaple,
    }));
};

const hasPositivePriceEstimate = (
  prices?: ShoppingList["metadata"]["estimatedCostAudByStore"],
): prices is NonNullable<ShoppingList["metadata"]["estimatedCostAudByStore"]> => (
  Boolean(prices && Object.values(prices).some((price) => price > 0))
);

const getPreferredRecipeArray = <T>(primary: T[] | undefined, fallback: T[]): T[] => (
  Array.isArray(primary) && primary.length > 0 ? primary : fallback
);

const buildRecipeMealPrepStrategy = (items: ShoppingItem[]): ShoppingList["mealPrepStrategy"] => {
  const proteins = items.filter((item) => item.category === "proteins").map((item) => item.item);
  const produce = items.filter((item) => item.category === "produce").map((item) => item.item);
  const pantry = items.filter((item) => item.category === "pantry").map((item) => item.item);

  return {
    batchCookItems: [...proteins.slice(0, 2), ...pantry.slice(0, 2)],
    prepOrder: ["Proteins", "Produce", "Pantry"],
    storageInstructions: [
      "Prep proteins first and refrigerate them in sealed containers.",
      "Wash and portion vegetables after proteins are cooked.",
      "Keep pantry staples and sauces portioned for quick assembly.",
    ],
    equipmentNeeded: ["Meal prep containers", "Kitchen scale", "Labels"],
  };
};

export function generateRecipeShoppingListFromIngredients(dietPlan: DietPlan): ShoppingList {
  const items = buildRecipeShoppingItemsFromPlan(dietPlan);
  const categories = shoppingCategories.reduce<ShoppingList["categories"]>(
    (currentCategories, categoryName) => ({
      ...currentCategories,
      [categoryName]: items.filter((item) => item.category === categoryName),
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
  const byStoreSection = Array.from(new Map(
    items.map((item) => [item.storeSection ?? "General", item.storeSection ?? "General"]),
  ).values())
    .map<ShoppingStoreSection>((sectionName) => ({
      section: sectionName,
      items: items.filter((item) => (item.storeSection ?? "General") === sectionName),
    }))
    .filter((section) => section.items.length > 0);
  const estimatedCostAudByStore = buildEstimatedStorePrices(items);
  const recommendedStore = buildRecommendedStore(estimatedCostAudByStore);
  const pantryChecklist = categories.pantry
    .filter((item) => item.isPantryStaple)
    .map((item) => item.item);

  return {
    metadata: {
      totalItems: items.length,
      estimatedCost: estimatedCostAudByStore.aldi,
      estimatedCostAudByStore,
      recommendedStore,
      currency: "AUD",
      storeSections: byStoreSection.length,
      prepTime: "45 minutes",
      daysCovered: 7,
    },
    categories,
    byStoreSection,
    mealPrepStrategy: buildRecipeMealPrepStrategy(items),
    pantryChecklist,
    costOptimizations: [
      "Buy pantry staples in larger packs when the same ingredient appears multiple times.",
      "Choose the recommended store for the lowest estimated basket total.",
    ],
  };
}

const mergeRecipeShoppingList = (
  rawShoppingList: RawShoppingList,
  dietPlan: DietPlan,
): ShoppingList => {
  const ingredientDrivenShoppingList = generateRecipeShoppingListFromIngredients(dietPlan);
  const aiShoppingList = normaliseShoppingList(rawShoppingList);
  const ingredientDrivenPrices = ingredientDrivenShoppingList.metadata.estimatedCostAudByStore ?? {
    coles: ingredientDrivenShoppingList.metadata.estimatedCost,
    woolworths: ingredientDrivenShoppingList.metadata.estimatedCost,
    aldi: ingredientDrivenShoppingList.metadata.estimatedCost,
  };
  const estimatedCostAudByStore: NonNullable<ShoppingList["metadata"]["estimatedCostAudByStore"]> = hasPositivePriceEstimate(aiShoppingList.metadata.estimatedCostAudByStore)
    ? aiShoppingList.metadata.estimatedCostAudByStore
    : ingredientDrivenPrices;
  const recommendedStore: "Coles" | "Woolworths" | "Aldi" = hasPositivePriceEstimate(aiShoppingList.metadata.estimatedCostAudByStore)
    ? (aiShoppingList.metadata.recommendedStore ?? buildRecommendedStore(estimatedCostAudByStore))
    : (ingredientDrivenShoppingList.metadata.recommendedStore ?? buildRecommendedStore(estimatedCostAudByStore));
  const recommendedStoreKey = recommendedStore.toLowerCase() as "coles" | "woolworths" | "aldi";

  return {
    metadata: {
      ...ingredientDrivenShoppingList.metadata,
      estimatedCostAudByStore,
      estimatedCost: aiShoppingList.metadata.estimatedCost > 0
        ? aiShoppingList.metadata.estimatedCost
        : estimatedCostAudByStore[recommendedStoreKey],
      recommendedStore,
      prepTime: aiShoppingList.metadata.prepTime || ingredientDrivenShoppingList.metadata.prepTime,
    },
    categories: ingredientDrivenShoppingList.categories,
    byStoreSection: ingredientDrivenShoppingList.byStoreSection,
    mealPrepStrategy: aiShoppingList.mealPrepStrategy.batchCookItems.length > 0
      ? aiShoppingList.mealPrepStrategy
      : ingredientDrivenShoppingList.mealPrepStrategy,
    pantryChecklist: getPreferredRecipeArray(
      aiShoppingList.pantryChecklist,
      ingredientDrivenShoppingList.pantryChecklist,
    ),
    costOptimizations: getPreferredRecipeArray(
      aiShoppingList.costOptimizations,
      ingredientDrivenShoppingList.costOptimizations,
    ),
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
    const shoppingList = dietType === "recipes"
      ? mergeRecipeShoppingList(response.shoppingList ?? {}, dietPlan)
      : normaliseShoppingList(response.shoppingList ?? {});

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
    if (dietType === "recipes") {
      return {
        success: true,
        data: generateRecipeShoppingListFromIngredients(dietPlan),
        metadata: {
          userId: userId,
          dietPlanCalories: dietPlan.summary.dailyCalories,
          generatedAt: new Date().toISOString(),
        },
      };
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to generate shopping list: ${errorMessage}`);
  }
}

/**
 * Builds shopping prompt from diet plan
 */
export function buildShoppingPrompt(dietPlan: DietPlan, dietType: DietType): string {
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
  const recipePromptRequirements = dietType === "recipes"
    ? `
10. Use each meal's "ingredients" array as the source of truth for the shopping list
11. Return ingredient rows only. Do not return recipe names or meal titles as shopping items
12. Combine duplicate ingredients across all days into single totals
13. Every price in estimatedCostAudByStore must be a numeric AUD amount without currency symbols`
    : "";

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
${recipePromptRequirements}

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
