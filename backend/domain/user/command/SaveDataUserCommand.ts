export interface SaveDataUserCommand {
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
  numberOfMeals: number;
  injuries: string[];
  favoriteFoods: string[];
  supplementation: string[];
  favorieteCoucineRecipes: string[];
}
