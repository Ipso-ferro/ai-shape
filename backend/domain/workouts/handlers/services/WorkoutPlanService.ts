import { NotFoundError } from "../../../share/Errors/AppErrors";
import { RepositoryUser } from "../../../user/repositories/RepositoryUser";
import { NutritionGoalCalculatorService } from "../../../user/handlers/services/NutritionGoalCalculatorService";
import { generateWorkoutPlan } from "../../../../src/api/workOutPlanGenerator";
import {
  ApiResponse,
  DataUserCommand as PlanDataUserCommand,
  PlanWeek,
  WorkoutPlan,
} from "../../../../src/types";
import { validatePlanWeek, validateUserData } from "../../../../src/utils/validators";
import { WorkoutsCommand } from "../../command/WorkoutsCommand";

export type WorkoutPlanGenerator = (
  userData: PlanDataUserCommand,
) => Promise<ApiResponse<WorkoutPlan>>;

export class WorkoutPlanService {
  constructor(
    private readonly repositoryUser: RepositoryUser,
    private readonly workoutPlanGenerator: WorkoutPlanGenerator = generateWorkoutPlan,
    private readonly nutritionGoalCalculatorService = new NutritionGoalCalculatorService(),
  ) {}

  async generatePlan(command: WorkoutsCommand): Promise<WorkoutPlan> {
    const userData = await this.repositoryUser.getDataUser({ id: command.userId });

    if (!userData) {
      throw new NotFoundError(`User with id "${command.userId}" was not found.`);
    }

    const hydratedUserData = this.nutritionGoalCalculatorService.hydrate(userData);
    validateUserData(hydratedUserData as PlanDataUserCommand);
    const week = resolvePlanWeek(command.week);
    validatePlanWeek(week);

    const result = await this.workoutPlanGenerator(
      hydratedUserData as PlanDataUserCommand,
    );

    return this.repositoryUser.saveWorkoutPlan(command.userId, result.data, {
      week,
    });
  }

  async getPlan(userId: string, week?: PlanWeek): Promise<WorkoutPlan> {
    const planWeek = resolvePlanWeek(week);
    validatePlanWeek(planWeek);
    const plan = await this.repositoryUser.getWorkoutPlan(userId, {
      week: planWeek,
    });

    if (!plan) {
      throw new NotFoundError(`Workout plan for user "${userId}" was not found.`);
    }

    return plan;
  }
}

const resolvePlanWeek = (requestedWeek?: PlanWeek): PlanWeek => (
  requestedWeek === "next" ? "next" : "current"
);
