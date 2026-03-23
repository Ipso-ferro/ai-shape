import { RepositoryUser } from "../../user/repositories/RepositoryUser";
import { UserProgressDay, UserProgressSummary } from "../../../src/types";
import { TrackMealProgressCommand } from "../command/TrackMealProgressCommand";
import { TrackWorkoutProgressCommand } from "../command/TrackWorkoutProgressCommand";
import { GetUserProgressDayQuery } from "../queries/GetUserProgressDayQuery";
import { GetUserProgressSummaryQuery } from "../queries/GetUserProgressSummaryQuery";
import { UserProgressTrackingService } from "./services/UserProgressTrackingService";

export class ProgressHandler {
  private readonly trackingService: UserProgressTrackingService;

  constructor(repositoryUser: RepositoryUser) {
    this.trackingService = new UserProgressTrackingService(repositoryUser);
  }

  trackMeal(command: TrackMealProgressCommand): Promise<UserProgressDay> {
    return this.trackingService.trackMeal(command);
  }

  trackWorkout(command: TrackWorkoutProgressCommand): Promise<UserProgressDay> {
    return this.trackingService.trackWorkout(command);
  }

  getDay(query: GetUserProgressDayQuery): Promise<UserProgressDay> {
    return this.trackingService.getDay(query);
  }

  getSummary(query: GetUserProgressSummaryQuery): Promise<UserProgressSummary> {
    return this.trackingService.getSummary(query);
  }
}
