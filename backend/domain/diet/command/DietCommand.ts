export type DietType = "recipes" | "single-food";

export interface DietCommand {
  userId: string;
  dietType?: DietType;
}
