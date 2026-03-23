import { NotFoundError } from "../../../share/Errors/AppErrors";
import { RepositoryUser } from "../../../user/repositories/RepositoryUser";
import { NutritionGoalCalculatorService } from "../../../user/handlers/services/NutritionGoalCalculatorService";
import { generateDietPlan } from "../../../../src/api/dietPlanGenerator";
import {
  ApiResponse,
  DataUserCommand as PlanDataUserCommand,
  DietPlan,
} from "../../../../src/types";
import {
  validateDietType,
  validateUserData,
} from "../../../../src/utils/validators";
import { DietCommand, DietType } from "../../command/DietCommand";

export type DietPlanGenerator = (
  userData: PlanDataUserCommand,
  dietType: DietType,
) => Promise<ApiResponse<DietPlan>>;

export class DietPlanService {
  constructor(
    private readonly repositoryUser: RepositoryUser,
    private readonly dietPlanGenerator: DietPlanGenerator = generateDietPlan,
    private readonly nutritionGoalCalculatorService = new NutritionGoalCalculatorService(),
  ) {}

  async generatePlan(command: DietCommand): Promise<DietPlan> {
    const userData = await this.repositoryUser.getDataUser({ id: command.userId });

    if (!userData) {
      throw new NotFoundError(`User with id "${command.userId}" was not found.`);
    }

    const hydratedUserData = this.nutritionGoalCalculatorService.hydrate(userData);
    validateUserData(hydratedUserData as PlanDataUserCommand);

    const dietType = resolveDietType(command.dietType, userData.kindOfDiet);
    validateDietType(dietType);

    const result = await this.dietPlanGenerator(
      hydratedUserData as PlanDataUserCommand,
      dietType,
    );

    return this.repositoryUser.saveDietPlan(command.userId, result.data, dietType);
  }

  async getPlan(userId: string): Promise<DietPlan> {
    const plan = await this.repositoryUser.getDietPlan(userId);

    if (!plan) {
      throw new NotFoundError(`Diet plan for user "${userId}" was not found.`);
    }

    return plan;
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
