export type DietType = "recipes" | "single-food";

export interface GenerateCompletePlanCommand {
  userId: string;
  dietType?: DietType;
}
