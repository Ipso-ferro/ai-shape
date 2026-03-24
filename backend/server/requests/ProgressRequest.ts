import { DietType, PlanWeek, TrackableMealSlot } from "../../src/types";

export interface ProgressRouteParams {
  id: string;
}

export interface ProgressMealRouteParams extends ProgressRouteParams {
  mealSlot: TrackableMealSlot;
}

export interface TrackProgressRequestBody {
  date?: string;
  completed?: boolean;
  dietType?: DietType;
  week?: PlanWeek;
}

export interface ProgressDayRequestQuery {
  date?: string;
}

export interface ProgressSummaryRequestQuery {
  period?: string;
  date?: string;
}
