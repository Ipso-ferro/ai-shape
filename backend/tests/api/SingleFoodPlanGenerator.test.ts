import test from "node:test";
import assert from "node:assert/strict";
import { DataUserCommand } from "../../src/types";
import {
  buildSingleFoodDayPrompt,
  buildSingleFoodPrompt,
} from "../../src/api/SingleFoodPlanGenerator";

const buildUser = (supplementation: string[]): DataUserCommand => ({
  id: "single-food-user",
  name: "Single Food Tester",
  age: 34,
  gender: "female",
  weight: 68,
  height: 170,
  goal: "muscle-gain",
  diet: "omnivore",
  kindOfDiet: "single-food",
  energyUnitPreference: "kj",
  avoidedFoods: [],
  allergies: [],
  levelActivity: "moderate",
  trainLocation: "gym",
  timeToTrain: 60,
  numberOfMeals: 4,
  caloriesTarget: 2200,
  kilojoulesTarget: 9205,
  proteinTarget: 160,
  carbsTarget: 220,
  fatsTarget: 70,
  injuries: [],
  favoriteFoods: ["oats", "eggs"],
  supplementation,
  favorieteCoucineRecipes: [],
  isPro: false,
});

const buildUserWithMealCount = (
  supplementation: string[],
  numberOfMeals: number,
): DataUserCommand => ({
  ...buildUser(supplementation),
  numberOfMeals,
});

test("single-food weekly prompt requires listed supplements", () => {
  const prompt = buildSingleFoodPrompt(buildUser(["creatine", "whey protein"]), false);

  assert.match(prompt, /Current supplementation: creatine, whey protein/);
  assert.match(prompt, /Do not leave supplements empty/i);
  assert.match(prompt, /include the user's listed supplements/i);
});

test("single-food daily prompt requires listed supplements", () => {
  const prompt = buildSingleFoodDayPrompt(buildUser(["creatine"]), 1, "Monday");

  assert.match(prompt, /Current supplementation: creatine/);
  assert.match(prompt, /Include each listed supplement exactly once/i);
});

test("single-food prompt keeps supplements empty when none are configured", () => {
  const prompt = buildSingleFoodPrompt(buildUser([]), true);

  assert.match(prompt, /Use an empty supplements array/);
});

test("single-food prompts require a non-empty supplements slot when 6 meals are requested", () => {
  const weeklyPrompt = buildSingleFoodPrompt(buildUserWithMealCount([], 6), true);
  const dailyPrompt = buildSingleFoodDayPrompt(buildUserWithMealCount([], 6), 1, "Monday");

  assert.doesNotMatch(weeklyPrompt, /Use an empty supplements array/);
  assert.match(weeklyPrompt, /sixth intake slot/i);
  assert.match(dailyPrompt, /do not leave the supplements array empty/i);
});
