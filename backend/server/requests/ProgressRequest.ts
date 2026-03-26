import { DietType, PlanWeek, TrackableMealSlot, UserExerciseLogInput } from "../../src/types";

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
  exerciseLogs?: UserExerciseLogInput[];
}

export interface ProgressDayRequestQuery {
  date?: string;
}

export interface ProgressSummaryRequestQuery {
  period?: string;
  date?: string;
}

export interface ProgressRangeRequestQuery {
  startDate?: string;
  endDate?: string;
}
