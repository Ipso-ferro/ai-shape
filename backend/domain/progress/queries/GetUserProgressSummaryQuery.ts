import { UserProgressPeriod } from "../../../src/types";

export interface GetUserProgressSummaryQuery {
  userId: string;
  period: UserProgressPeriod;
  date: string;
}
