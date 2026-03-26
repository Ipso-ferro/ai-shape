export type EnergyUnit = "kj" | "cal";

export interface DataUserCommand {
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
