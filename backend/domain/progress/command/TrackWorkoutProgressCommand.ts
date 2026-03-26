import { UserExerciseLogInput } from "../../../src/types";

export interface TrackWorkoutProgressCommand {
  userId: string;
  date: string;
  completed: boolean;
  exerciseLogs?: UserExerciseLogInput[];
}
