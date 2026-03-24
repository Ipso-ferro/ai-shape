import { NotFoundError } from "../../share/Errors/AppErrors";
import { generateCompletePlan } from "../../../src/services/completePlanService";
import {
  CompletePlanResult,
  DataUserCommand as PlanDataUserCommand,
} from "../../../src/types";
import {
  validateDietType,
  validatePlanWeek,
  validateUserData,
} from "../../../src/utils/validators";
import {
  GenerateCompletePlanCommand,
  DietType,
  PlanWeek,
} from "../command/GenerateCompletePlanCommand";
import { RepositoryUser } from "../repositories/RepositoryUser";
import { NutritionGoalCalculatorService } from "./services/NutritionGoalCalculatorService";

type CompletePlanGenerator = (
  userData: PlanDataUserCommand,
  dietType?: DietType,
) => Promise<CompletePlanResult>;

export class UserPlanHandler {
  constructor(
    private readonly repositoryUser: RepositoryUser,
    private readonly completePlanGenerator: CompletePlanGenerator = generateCompletePlan,
    private readonly nutritionGoalCalculatorService = new NutritionGoalCalculatorService(),
  ) {}

  async generateCompletePlan(
    command: GenerateCompletePlanCommand,
  ): Promise<CompletePlanResult> {
    const userData = await this.repositoryUser.getDataUser({ id: command.userId });

    if (!userData) {
      throw new NotFoundError(`User with id "${command.userId}" was not found.`);
    }

    const hydratedUserData = this.nutritionGoalCalculatorService.hydrate(userData);
    validateUserData(hydratedUserData as PlanDataUserCommand);

    const dietType = resolveDietType(command.dietType, userData.kindOfDiet);
    const week = resolvePlanWeek(command.week);
    validateDietType(dietType);
    validatePlanWeek(week);

    const result = await this.completePlanGenerator(
      hydratedUserData as PlanDataUserCommand,
      dietType,
    );

    if (result.dietPlan) {
      await this.repositoryUser.saveDietPlan(
        command.userId,
        result.dietPlan,
        dietType,
        {
          week,
        },
      );
    }

    if (result.workoutPlan) {
      await this.repositoryUser.saveWorkoutPlan(command.userId, result.workoutPlan);
    }

    if (result.shoppingList) {
      result.shoppingList = await this.repositoryUser.saveShoppingList(
        command.userId,
        result.shoppingList,
        dietType,
        week,
      );
    }

    return result;
  }
}

const resolveDietType = (
  requestedDietType?: DietType,
  savedDietType?: string,
): DietType => {
  if (requestedDietType) {
    return requestedDietType;
  }

  return savedDietType === "single-food" ? "single-food" : "recipes";
};

const resolvePlanWeek = (requestedWeek?: PlanWeek): PlanWeek => (
  requestedWeek === "next" ? "next" : "current"
);
