import { DietType, EnergyUnit, MealSlot, ViewKey } from "./types";

export const storageKey = "ai-shape-session";

export const viewLabels: Record<ViewKey, string> = {
  dashboard: "Dashboard",
  diet: "Diet",
  workout: "Workout",
  shopping: "Market List",
  settings: "Settings",
};

export const mealConfig: Array<{
  slot: MealSlot;
  title: string;
}> = [
  { slot: "breakfast", title: "Breakfast" },
  { slot: "snack1", title: "Snack 1" },
  { slot: "lunch", title: "Lunch" },
  { slot: "dinner", title: "Dinner" },
  { slot: "snack2", title: "Snack 2" },
  { slot: "supplements", title: "Supplements" },
];

export const dietTypeOptions: Array<{ label: string; value: DietType }> = [
  { label: "Single Foods", value: "single-food" },
  { label: "Recipes", value: "recipes" },
];

export const energyUnitOptions: Array<{ label: string; value: EnergyUnit }> = [
  { label: "Kilojoules (kJ)", value: "kj" },
  { label: "Calories (kcal)", value: "cal" },
];

export const profileOptions = {
  genders: ["female", "male", "non-binary"],
  goals: ["fat-loss", "maintenance", "muscle-gain", "recomposition"],
  diets: ["omnivore", "vegetarian", "vegan", "pescatarian", "balanced"],
  activityLevels: ["sedentary", "light", "moderate", "active", "athlete"],
  locations: ["gym", "home", "outdoor", "hybrid", "home and gym"],
};
