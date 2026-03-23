import { ValidationError } from "../../domain/share/Errors/AppErrors";
import { DataUserCommand, DietType } from "../types";

export const validateDietType = (dietType: DietType): void => {
  if (dietType !== "recipes" && dietType !== "single-food") {
    throw new ValidationError(`Unsupported diet type "${dietType}".`);
  }
};

export const validateUserData = (userData: DataUserCommand): void => {
  const missingFields: string[] = [];

  const requiredStringFields: Array<[string, string]> = [
    ["id", userData.id],
    ["name", userData.name],
    ["gender", userData.gender],
    ["goal", userData.goal],
    ["diet", userData.diet],
    ["kindOfDiet", userData.kindOfDiet],
    ["levelActivity", userData.levelActivity],
    ["trainLocation", userData.trainLocation],
  ];

  for (const [fieldName, value] of requiredStringFields) {
    if (value.trim().length === 0) {
      missingFields.push(fieldName);
    }
  }

  const requiredNumberFields: Array<[string, number]> = [
    ["age", userData.age],
    ["weight", userData.weight],
    ["height", userData.height],
    ["timeToTrain", userData.timeToTrain],
    ["numberOfMeals", userData.numberOfMeals],
    ["caloriesTarget", userData.caloriesTarget],
    ["kilojoulesTarget", userData.kilojoulesTarget],
    ["proteinTarget", userData.proteinTarget],
    ["carbsTarget", userData.carbsTarget],
    ["fatsTarget", userData.fatsTarget],
  ];

  for (const [fieldName, value] of requiredNumberFields) {
    if (!Number.isFinite(value) || value <= 0) {
      missingFields.push(fieldName);
    }
  }

  const requiredArrayFields: Array<[string, unknown[]]> = [
    ["avoidedFoods", userData.avoidedFoods],
    ["allergies", userData.allergies],
    ["injuries", userData.injuries],
    ["favoriteFoods", userData.favoriteFoods],
    ["supplementation", userData.supplementation],
    ["favorieteCoucineRecipes", userData.favorieteCoucineRecipes],
  ];

  for (const [fieldName, value] of requiredArrayFields) {
    if (!Array.isArray(value)) {
      missingFields.push(fieldName);
    }
  }

  if (missingFields.length > 0) {
    throw new ValidationError(
      `User profile is incomplete for plan generation. Missing or invalid fields: ${missingFields.join(", ")}.`,
    );
  }
};
