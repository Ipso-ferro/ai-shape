import { DataUserCommand } from "../command/DataUserCommand";
import { CreateUserRecordCommand } from "../command/CreateUserRecordCommand";
import { UserCredentials } from "../models/UserCredentials";
import { GetDataUserQuery } from "../queries/GetDataUserQuery";
import { GetUserCredentialsByEmailQuery } from "../queries/GetUserCredentialsByEmailQuery";
import {
  DietPlan,
  ShoppingList,
  WorkoutPlan,
  DietType,
  UserProgressDay,
} from "../../../src/types";

export interface RepositoryUser {
  addNewUser(user: CreateUserRecordCommand): Promise<void>;
  saveDataUser(dataUserCommand: DataUserCommand): Promise<void>;
  getDataUser(query: GetDataUserQuery): Promise<DataUserCommand | null>;
  getAllUsers(): Promise<DataUserCommand[]>;
  saveDietPlan(userId: string, dietPlan: DietPlan, dietType: DietType): Promise<DietPlan>;
  getDietPlan(userId: string): Promise<DietPlan | null>;
  saveWorkoutPlan(userId: string, workoutPlan: WorkoutPlan): Promise<WorkoutPlan>;
  getWorkoutPlan(userId: string): Promise<WorkoutPlan | null>;
  saveShoppingList(userId: string, shoppingList: ShoppingList): Promise<ShoppingList>;
  getShoppingList(userId: string): Promise<ShoppingList | null>;
  toggleShoppingListItem(
    userId: string,
    itemId: string,
    checked: boolean,
  ): Promise<ShoppingList>;
  saveUserProgressDay(progressDay: UserProgressDay): Promise<UserProgressDay>;
  getUserProgressDay(userId: string, date: string): Promise<UserProgressDay | null>;
  listUserProgressDays(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<UserProgressDay[]>;
  getUserCredentialsByEmail(
    query: GetUserCredentialsByEmailQuery,
  ): Promise<UserCredentials | null>;
  saveUserGoogleSub(userId: string, googleSub: string): Promise<void>;
}
