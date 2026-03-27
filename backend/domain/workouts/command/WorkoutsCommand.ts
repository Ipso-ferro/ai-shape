import { PlanWeek } from "../../../src/types";

export interface WorkoutsCommand {
  userId: string;
  week?: PlanWeek;
}
