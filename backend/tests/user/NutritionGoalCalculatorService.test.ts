import test from "node:test";
import assert from "node:assert/strict";
import { NutritionGoalCalculatorService } from "../../domain/user/handlers/services/NutritionGoalCalculatorService";

const service = new NutritionGoalCalculatorService();

test("NutritionGoalCalculatorService calculates targets from the user goal", () => {
  const targets = service.calculate({
    age: 28,
    gender: "male",
    weight: 75,
    height: 178,
    goal: "muscle-gain",
    levelActivity: "moderate",
  });

  assert.deepEqual(targets, {
    caloriesTarget: 2978,
    kilojoulesTarget: 12460,
    proteinTarget: 223,
    carbsTarget: 335,
    fatsTarget: 83,
  });
});

test("NutritionGoalCalculatorService preserves existing targets when hydrating", () => {
  const hydratedProfile = service.hydrate({
    age: 28,
    gender: "male",
    weight: 75,
    height: 178,
    goal: "muscle-gain",
    levelActivity: "moderate",
    caloriesTarget: 2500,
    kilojoulesTarget: 10460,
    proteinTarget: 180,
    carbsTarget: 280,
    fatsTarget: 70,
  });

  assert.equal(hydratedProfile.caloriesTarget, 2500);
  assert.equal(hydratedProfile.kilojoulesTarget, 10460);
  assert.equal(hydratedProfile.proteinTarget, 180);
  assert.equal(hydratedProfile.carbsTarget, 280);
  assert.equal(hydratedProfile.fatsTarget, 70);
});
