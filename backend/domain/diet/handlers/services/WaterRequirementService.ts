import { DataUserCommand } from "../../../user/command/DataUserCommand";
import { SaveDataUserCommand } from "../../../user/command/SaveDataUserCommand";

export interface WaterRequirement {
  targetLiters: number;
  targetGlasses: number;
  litersPerGlass: number;
}

type WaterProfile = Pick<
  SaveDataUserCommand | DataUserCommand,
  "weight" | "gender" | "levelActivity" | "timeToTrain" | "goal"
>;

const litersPerGlass = 1;

export class WaterRequirementService {
  calculate(profile: WaterProfile): WaterRequirement {
    const baseLiters = Math.max(2, profile.weight * 0.035);
    const activityBonus = this.getActivityBonus(profile.levelActivity);
    const trainingBonus = Math.max(0, profile.timeToTrain / 60) * 0.5;
    const goalBonus = this.getGoalBonus(profile.goal, profile.gender);
    const targetLiters = Math.round((baseLiters + activityBonus + trainingBonus + goalBonus) * 10) / 10;

    return {
      targetLiters,
      targetGlasses: Math.max(1, Math.ceil(targetLiters / litersPerGlass)),
      litersPerGlass,
    };
  }

  private getActivityBonus(levelActivity: string): number {
    const normalizedActivity = levelActivity.trim().toLowerCase();
    const bonuses: Record<string, number> = {
      sedentary: 0,
      light: 0.2,
      moderate: 0.4,
      active: 0.7,
      very_active: 1,
    };

    return bonuses[normalizedActivity] ?? 0.4;
  }

  private getGoalBonus(goal: string, gender: string): number {
    const normalizedGoal = goal.trim().toLowerCase();
    const normalizedGender = gender.trim().toLowerCase();
    let bonus = normalizedGender === "male" ? 0.2 : 0;

    if (normalizedGoal.includes("muscle") || normalizedGoal.includes("gain") || normalizedGoal.includes("bulk")) {
      bonus += 0.2;
    }

    if (normalizedGoal.includes("endur")) {
      bonus += 0.3;
    }

    return bonus;
  }
}
