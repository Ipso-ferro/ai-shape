import { DataUserCommand } from "../command/DataUserCommand";
import { CreateUserRecordCommand } from "../command/CreateUserRecordCommand";
import { UserCredentials } from "../models/UserCredentials";
import { GetDataUserQuery } from "../queries/GetDataUserQuery";
import { GetUserCredentialsByEmailQuery } from "../queries/GetUserCredentialsByEmailQuery";
import {
  DietPlan,
  TrackableMealSlot,
  PlanSelectionOptions,
  SaveDietPlanOptions,
  ShoppingList,
  UserExerciseLog,
  UserTrackingEntry,
  UserExerciseLogInput,
  WorkoutPlan,
  DietType,
  PlanWeek,
  UserProgressDay,
} from "../../../src/types";

export interface RepositoryUser {
  addNewUser(user: CreateUserRecordCommand): Promise<void>;
  saveDataUser(dataUserCommand: DataUserCommand): Promise<void>;
  getDataUser(query: GetDataUserQuery): Promise<DataUserCommand | null>;
  getAllUsers(): Promise<DataUserCommand[]>;
  saveDietPlan(
    userId: string,
    dietPlan: DietPlan,
    dietType: DietType,
    options?: SaveDietPlanOptions,
  ): Promise<DietPlan>;
  getDietPlan(userId: string, options?: PlanSelectionOptions): Promise<DietPlan | null>;
  saveWorkoutPlan(userId: string, workoutPlan: WorkoutPlan): Promise<WorkoutPlan>;
  getWorkoutPlan(userId: string): Promise<WorkoutPlan | null>;
  saveShoppingList(
    userId: string,
    shoppingList: ShoppingList,
    dietType: DietType,
    week?: PlanWeek,
  ): Promise<ShoppingList>;
  getShoppingList(userId: string, options?: PlanSelectionOptions): Promise<ShoppingList | null>;
  toggleShoppingListItem(
    userId: string,
    itemId: string,
    checked: boolean,
    options?: PlanSelectionOptions,
  ): Promise<ShoppingList>;
  saveUserProgressDay(progressDay: UserProgressDay): Promise<UserProgressDay>;
  syncDietPlanMealEatenState(
    userId: string,
    dietType: DietType,
    dayNumber: number,
    mealSlot: TrackableMealSlot,
    eaten: boolean,
    week?: PlanWeek,
  ): Promise<void>;
  syncWorkoutPlanDayCompletionState(
    userId: string,
    dayNumber: number,
    completed: boolean,
  ): Promise<void>;
  getUserProgressDay(userId: string, date: string): Promise<UserProgressDay | null>;
  listUserProgressDays(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<UserProgressDay[]>;
  saveUserTrackingEntry(entry: UserTrackingEntry): Promise<UserTrackingEntry>;
  listUserTrackingEntries(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<UserTrackingEntry[]>;
  replaceUserExerciseLogs(
    userId: string,
    date: string,
    logs: UserExerciseLogInput[],
  ): Promise<UserExerciseLog[]>;
  listUserExerciseLogs(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<UserExerciseLog[]>;
  getUserCredentialsByEmail(
    query: GetUserCredentialsByEmailQuery,
  ): Promise<UserCredentials | null>;
  saveUserGoogleSub(userId: string, googleSub: string): Promise<void>;
}
