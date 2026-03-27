import { AddNewUserCommand } from "../../domain/user/command/AddNewUserCommand";
import { GenerateCompletePlanCommand } from "../../domain/user/command/GenerateCompletePlanCommand";
import { SaveDataUserCommand } from "../../domain/user/command/SaveDataUserCommand";
import { DietCommand } from "../../domain/diet/command/DietCommand";

export type AddNewUserRequestBody = AddNewUserCommand;
export type SaveDataUserRequestBody = Omit<SaveDataUserCommand, "id">;
export type GenerateDietPlanRequestBody = Omit<DietCommand, "userId">;
export interface GenerateWorkoutPlanRequestBody {
  week?: "current" | "next";
}
export type GenerateCompletePlanRequestBody = Omit<
  GenerateCompletePlanCommand,
  "userId"
>;

export interface UserRouteParams {
  id: string;
}

export interface PlanSelectionQuery {
  dietType?: string;
  week?: string;
}
