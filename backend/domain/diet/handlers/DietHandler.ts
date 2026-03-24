import { RepositoryUser } from "../../user/repositories/RepositoryUser";
import { NutritionGoalCalculatorService } from "../../user/handlers/services/NutritionGoalCalculatorService";
import { generateDietPlan } from "../../../src/api/dietPlanGenerator";
import { DietPlan } from "../../../src/types";
import {
  DietCommand,
  DietType,
  PlanWeek,
} from "../command/DietCommand";
import {
  DietPlanGenerator,
  DietPlanService,
} from "./services/DietPlanService";

export class DietHandler {
  private readonly dietPlanService: DietPlanService;

  constructor(
    repositoryUser: RepositoryUser,
    dietPlanGenerator: DietPlanGenerator = generateDietPlan,
    nutritionGoalCalculatorService = new NutritionGoalCalculatorService(),
  ) {
    this.dietPlanService = new DietPlanService(
      repositoryUser,
      dietPlanGenerator,
      nutritionGoalCalculatorService,
    );
  }

  async generatePlan(command: DietCommand): Promise<DietPlan> {
    return this.dietPlanService.generatePlan(command);
  }

  async getPlan(
    userId: string,
    options?: {
      dietType?: DietType;
      week?: PlanWeek;
    },
  ): Promise<DietPlan> {
    return this.dietPlanService.getPlan(userId, options);
  }
}
