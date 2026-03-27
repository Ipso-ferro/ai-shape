import { RepositoryUser } from "../../user/repositories/RepositoryUser";
import { NutritionGoalCalculatorService } from "../../user/handlers/services/NutritionGoalCalculatorService";
import { generateWorkoutPlan } from "../../../src/api/workOutPlanGenerator";
import { PlanWeek, WorkoutPlan } from "../../../src/types";
import { WorkoutsCommand } from "../command/WorkoutsCommand";
import {
  WorkoutPlanGenerator,
  WorkoutPlanService,
} from "./services/WorkoutPlanService";

export class WorkoutsHandler {
  private readonly workoutPlanService: WorkoutPlanService;

  constructor(
    repositoryUser: RepositoryUser,
    workoutPlanGenerator: WorkoutPlanGenerator = generateWorkoutPlan,
    nutritionGoalCalculatorService = new NutritionGoalCalculatorService(),
  ) {
    this.workoutPlanService = new WorkoutPlanService(
      repositoryUser,
      workoutPlanGenerator,
      nutritionGoalCalculatorService,
    );
  }

  async generatePlan(command: WorkoutsCommand): Promise<WorkoutPlan> {
    return this.workoutPlanService.generatePlan(command);
  }

  async getPlan(userId: string, week?: PlanWeek): Promise<WorkoutPlan> {
    return this.workoutPlanService.getPlan(userId, week);
  }
}
