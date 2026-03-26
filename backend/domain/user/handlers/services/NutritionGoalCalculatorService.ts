import { DataUserCommand } from "../../command/DataUserCommand";
import { SaveDataUserCommand } from "../../command/SaveDataUserCommand";

export interface NutritionTargets {
  caloriesTarget: number;
  kilojoulesTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatsTarget: number;
}

type GoalProfile = Pick<
  SaveDataUserCommand | DataUserCommand,
  "age" | "gender" | "weight" | "height" | "goal" | "levelActivity"
>;

export class NutritionGoalCalculatorService {
  calculate(profile: GoalProfile): NutritionTargets {
    const bmr = this.calculateBmr(profile);
    const tdee = this.calculateTdee(bmr, profile.levelActivity);
    const caloriesTarget = Math.max(
      1200,
      Math.round(tdee + this.getGoalAdjustment(profile.goal)),
    );
    const macroSplit = this.getMacroSplit(profile.goal);

    return {
      caloriesTarget,
      kilojoulesTarget: Math.round(caloriesTarget * 4.184),
      proteinTarget: Math.round((caloriesTarget * macroSplit.protein) / 4),
      carbsTarget: Math.round((caloriesTarget * macroSplit.carbs) / 4),
      fatsTarget: Math.round((caloriesTarget * macroSplit.fats) / 9),
    };
  }

  hydrate<T extends GoalProfile>(profile: T & Partial<NutritionTargets>): T & NutritionTargets {
    if (
      this.hasCalculatedTargets(profile.caloriesTarget)
      && this.hasCalculatedTargets(profile.kilojoulesTarget)
      && this.hasCalculatedTargets(profile.proteinTarget)
      && this.hasCalculatedTargets(profile.carbsTarget)
      && this.hasCalculatedTargets(profile.fatsTarget)
    ) {
      return profile as T & NutritionTargets;
    }

    return {
      ...profile,
      ...this.calculate(profile),
    };
  }

  private calculateBmr(profile: GoalProfile): number {
    const normalizedGender = profile.gender.trim().toLowerCase();

    if (normalizedGender === "male") {
      return 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
    }

    return 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
  }

  private calculateTdee(bmr: number, activityLevel: string): number {
    const multipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    };

    return bmr * (multipliers[activityLevel.trim().toLowerCase()] ?? 1.55);
  }

  private getGoalAdjustment(goal: string): number {
    const normalizedGoal = goal.trim().toLowerCase();

    if (
      normalizedGoal.includes("weight-loss")
      || normalizedGoal.includes("fat-loss")
      || normalizedGoal.includes("lose")
    ) {
      return -500;
    }

    if (
      normalizedGoal.includes("muscle-gain")
      || normalizedGoal.includes("gain")
    ) {
      return 300;
    }

    if (normalizedGoal.includes("bulk")) {
      return 500;
    }

    if (normalizedGoal.includes("endur")) {
      return 200;
    }

    return 0;
  }

  private getMacroSplit(goal: string): {
    protein: number;
    carbs: number;
    fats: number;
  } {
    const normalizedGoal = goal.trim().toLowerCase();

    if (
      normalizedGoal.includes("weight-loss")
      || normalizedGoal.includes("fat-loss")
      || normalizedGoal.includes("lose")
    ) {
      return {
        protein: 0.35,
        carbs: 0.30,
        fats: 0.35,
      };
    }

    if (normalizedGoal.includes("endur")) {
      return {
        protein: 0.25,
        carbs: 0.50,
        fats: 0.25,
      };
    }

    if (
      normalizedGoal.includes("muscle-gain")
      || normalizedGoal.includes("gain")
      || normalizedGoal.includes("bulk")
    ) {
      return {
        protein: 0.30,
        carbs: 0.45,
        fats: 0.25,
      };
    }

    return {
      protein: 0.30,
      carbs: 0.40,
      fats: 0.30,
    };
  }

  private hasCalculatedTargets(value: number | undefined): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  }
}
