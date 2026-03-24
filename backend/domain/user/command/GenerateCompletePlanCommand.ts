export type DietType = "recipes" | "single-food";
export type PlanWeek = "current" | "next";

export interface GenerateCompletePlanCommand {
  userId: string;
  dietType?: DietType;
  week?: PlanWeek;
}
