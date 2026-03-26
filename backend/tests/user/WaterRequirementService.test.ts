import test from "node:test";
import assert from "node:assert/strict";
import { WaterRequirementService } from "../../domain/diet/handlers/services/WaterRequirementService";

const service = new WaterRequirementService();

test("WaterRequirementService rounds the daily target up to one-liter glasses", () => {
  const requirement = service.calculate({
    weight: 75,
    gender: "male",
    levelActivity: "moderate",
    timeToTrain: 60,
    goal: "muscle-gain",
  });

  assert.equal(requirement.targetLiters, 3.9);
  assert.equal(requirement.targetGlasses, 4);
  assert.equal(requirement.litersPerGlass, 1);
});

test("WaterRequirementService keeps a sensible floor for smaller inactive users", () => {
  const requirement = service.calculate({
    weight: 52,
    gender: "female",
    levelActivity: "sedentary",
    timeToTrain: 0,
    goal: "fat-loss",
  });

  assert.equal(requirement.targetLiters, 2);
  assert.equal(requirement.targetGlasses, 2);
});
