import { generateCompletePlan } from "./services/completePlanService";
import { SkillLoader } from "./utils/skillLoader";
import { DataUserCommand } from "./types";

SkillLoader.preload(["recipe-nutritionist", "single-food-nutritionist", "coach", "shopper"]);

const sampleUserData: DataUserCommand = {
  id: "user-123",
  name: "Carlos Mendez",
  age: 28,
  gender: "male",
  weight: 75,
  height: 178,
  goal: "muscle-gain",
  diet: "omnivore",
  kindOfDiet: "recipes",
  avoidedFoods: ["pork", "shellfish"],
  allergies: ["peanuts"],
  levelActivity: "moderate",
  trainLocation: "gym",
  timeToTrain: 60,
  numberOfMeals: 4,
  energyUnitPreference: "kj",
  caloriesTarget: 2978,
  kilojoulesTarget: 12460,
  proteinTarget: 223,
  carbsTarget: 335,
  fatsTarget: 83,
  injuries: ["previous shoulder strain - avoid heavy overhead pressing"],
  favoriteFoods: ["chicken", "rice", "avocado", "eggs"],
  supplementation: ["whey protein", "creatine", "vitamin d"],
  favorieteCoucineRecipes: ["latin", "mediterranean"],
  isPro: false,
};

generateCompletePlan(sampleUserData, "recipes")
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
