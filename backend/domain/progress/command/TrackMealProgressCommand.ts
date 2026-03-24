import { DietType, PlanWeek, TrackableMealSlot } from "../../../src/types";

export interface TrackMealProgressCommand {
  userId: string;
  date: string;
  mealSlot: TrackableMealSlot;
  completed: boolean;
  dietType?: DietType;
  week?: PlanWeek;
}
