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
  validatePlanWeek,
  validateUserData,
} from "../../../../src/utils/validators";
import {
  DietCommand,
  DietType,
  PlanWeek,
} from "../../command/DietCommand";

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
    const {
      dietType,
      week,
      hydratedUserData,
    } = await this.resolveGenerationContext(command.userId, command.dietType, command.week);

    const result = await this.dietPlanGenerator(
      hydratedUserData,
      dietType,
    );

    return this.repositoryUser.saveDietPlan(command.userId, result.data, dietType, {
      week,
      activateDietType: command.activateDietType,
    });
  }

  async getPlan(
    userId: string,
    options?: {
      dietType?: DietType;
      week?: PlanWeek;
    },
  ): Promise<DietPlan> {
    const week = options?.week ?? "current";
    const plan = await this.repositoryUser.getDietPlan(userId, options);

    if (plan) {
      return plan;
    }

    const userData = await this.repositoryUser.getDataUser({ id: userId });

    if (!userData) {
      throw new NotFoundError(`User with id "${userId}" was not found.`);
    }

    const recoveredPlan = await this.recoverRecipePlan(
      userId,
      userData,
      options?.dietType,
      week,
    );

    if (recoveredPlan) {
      return recoveredPlan;
    }

    throw new NotFoundError(`Diet plan for user "${userId}" was not found.`);
  }

  private async resolveGenerationContext(
    userId: string,
    requestedDietType?: DietType,
    requestedWeek?: PlanWeek,
  ): Promise<{
    dietType: DietType;
    week: PlanWeek;
    hydratedUserData: PlanDataUserCommand;
  }> {
    const userData = await this.repositoryUser.getDataUser({ id: userId });

    if (!userData) {
      throw new NotFoundError(`User with id "${userId}" was not found.`);
    }

    const hydratedUserData = this.nutritionGoalCalculatorService.hydrate(userData);
    validateUserData(hydratedUserData as PlanDataUserCommand);

    const dietType = resolveDietType(requestedDietType, userData.kindOfDiet);
    const week = resolvePlanWeek(requestedWeek);
    validateDietType(dietType);
    validatePlanWeek(week);

    return {
      dietType,
      week,
      hydratedUserData: hydratedUserData as PlanDataUserCommand,
    };
  }

  private async recoverRecipePlan(
    userId: string,
    userData: NonNullable<Awaited<ReturnType<RepositoryUser["getDataUser"]>>>,
    requestedDietType?: DietType,
    requestedWeek: PlanWeek = "current",
  ): Promise<DietPlan | null> {
    const dietType = resolveDietType(requestedDietType, userData.kindOfDiet);

    if (dietType !== "recipes" || requestedWeek !== "current") {
      return null;
    }

    try {
      const hydratedUserData = this.nutritionGoalCalculatorService.hydrate(userData);
      validateUserData(hydratedUserData as PlanDataUserCommand);

      const result = await this.dietPlanGenerator(
        hydratedUserData as PlanDataUserCommand,
        dietType,
      );

      return this.repositoryUser.saveDietPlan(userId, result.data, dietType, {
        week: "current",
      });
    } catch {
      return null;
    }
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
