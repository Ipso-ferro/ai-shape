import { RepositoryUser } from "../../user/repositories/RepositoryUser";
import { UserProgressDay, UserProgressSummary } from "../../../src/types";
import { TrackMealProgressCommand } from "../command/TrackMealProgressCommand";
import { TrackWorkoutProgressCommand } from "../command/TrackWorkoutProgressCommand";
import { TrackWaterProgressCommand } from "../command/TrackWaterProgressCommand";
import { GetUserExerciseLogsQuery } from "../queries/GetUserExerciseLogsQuery";
import { GetUserProgressDayQuery } from "../queries/GetUserProgressDayQuery";
import { GetUserProgressSummaryQuery } from "../queries/GetUserProgressSummaryQuery";
import { GetUserTrackingEntriesQuery } from "../queries/GetUserTrackingEntriesQuery";
import { GetUserWaterEntriesQuery } from "../queries/GetUserWaterEntriesQuery";
import { UserProgressTrackingService } from "./services/UserProgressTrackingService";
import { UserExerciseLog, UserTrackingEntry, UserWaterEntry } from "../../../src/types";

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

  trackWater(command: TrackWaterProgressCommand): Promise<UserWaterEntry> {
    return this.trackingService.trackWater(command);
  }

  getDay(query: GetUserProgressDayQuery): Promise<UserProgressDay> {
    return this.trackingService.getDay(query);
  }

  getSummary(query: GetUserProgressSummaryQuery): Promise<UserProgressSummary> {
    return this.trackingService.getSummary(query);
  }

  getTracking(query: GetUserTrackingEntriesQuery): Promise<UserTrackingEntry[]> {
    return this.trackingService.getTracking(query);
  }

  getWater(query: GetUserWaterEntriesQuery): Promise<UserWaterEntry[]> {
    return this.trackingService.getWater(query);
  }

  getExerciseLogs(query: GetUserExerciseLogsQuery): Promise<UserExerciseLog[]> {
    return this.trackingService.getExerciseLogs(query);
  }
}
