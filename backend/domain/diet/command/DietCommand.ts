export type DietType = "recipes" | "single-food";
export type PlanWeek = "current" | "next";

export interface DietCommand {
  userId: string;
  dietType?: DietType;
  week?: PlanWeek;
  activateDietType?: boolean;
}
