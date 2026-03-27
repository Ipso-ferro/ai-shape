import test, { after, before, mock } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { createServer } from "../../server/server";
import { AuthHandler } from "../../domain/auth/handlers/AuthHandler";
import { UserHandler } from "../../domain/user/handlers/UserHandler";
import { UserPlanHandler } from "../../domain/user/handlers/UserPlanHandler";
import { RepositoryUser } from "../../domain/user/repositories/RepositoryUser";
import { CreateUserRecordCommand } from "../../domain/user/command/CreateUserRecordCommand";
import { DataUserCommand } from "../../domain/user/command/DataUserCommand";
import { GetDataUserQuery } from "../../domain/user/queries/GetDataUserQuery";
import { GetUserCredentialsByEmailQuery } from "../../domain/user/queries/GetUserCredentialsByEmailQuery";
import { UserCredentials } from "../../domain/user/models/UserCredentials";
import { WorkoutsHandler } from "../../domain/workouts/handlers/WorkoutsHandler";
import { DietHandler } from "../../domain/diet/handlers/DietHandler";
import { ProgressHandler } from "../../domain/progress/handlers/ProgressHandler";
import { ShoppingListHandler } from "../../domain/shopping/handlers/ShoppingListHandler";
import { SessionTokenService } from "../../domain/auth/handlers/services/SessionTokenService";
import {
  ApiResponse,
  CompletePlanResult,
  DietPlan,
  DietPlanDayMealState,
  DietType,
  PlanSelectionOptions,
  PlanWeek,
  SaveDietPlanOptions,
  ShoppingList,
  TrackableMealSlot,
  UserExerciseLog,
  UserExerciseLogInput,
  UserProgressDay,
  UserTrackingEntry,
  UserWaterEntry,
  WorkoutPlan,
} from "../../src/types";

class RepositoryUserMock implements RepositoryUser {
  private readonly dietPlans = new Map<string, DietPlan>();
  private readonly workoutPlans = new Map<PlanWeek, WorkoutPlan>();
  private readonly shoppingLists = new Map<string, ShoppingList>();
  private readonly progressDays = new Map<string, UserProgressDay>();
  private readonly trackingEntries = new Map<string, UserTrackingEntry>();
  private readonly waterEntries = new Map<string, UserWaterEntry>();
  private readonly exerciseLogs = new Map<string, UserExerciseLog[]>();
  private readonly dietMealEatenStates = new Map<string, boolean>();
  private readonly workoutDayCompletionStates = new Map<string, boolean>();
  private readonly usersById = new Map<string, DataUserCommand>();
  private readonly credentialsByEmail = new Map<string, UserCredentials>();

  constructor(
    private readonly user: DataUserCommand | null,
    dietPlan: DietPlan | null = null,
    workoutPlan: WorkoutPlan | null = null,
  ) {
    if (user) {
      this.usersById.set(user.id, user);
    }

    if (dietPlan) {
      this.dietPlans.set("recipes:current", dietPlan);
      for (const day of dietPlan.days) {
        for (const mealSlot of ["breakfast", "snack1", "lunch", "dinner", "snack2", "supplements"] as const) {
          this.dietMealEatenStates.set(
            this.resolveDietDayStateKey("recipes", "current", day.day, mealSlot),
            false,
          );
        }
      }
    }

    if (workoutPlan) {
      this.workoutPlans.set("current", workoutPlan);
      for (const day of workoutPlan.days) {
        this.workoutDayCompletionStates.set(`current:${day.day}`, false);
      }
    }
  }

  private resolveDietKey(dietType: DietType = "recipes", week: PlanWeek = "current"): string {
    return `${dietType}:${week}`;
  }

  private resolveDietDayStateKey(
    dietType: DietType,
    week: PlanWeek,
    dayNumber: number,
    mealSlot: TrackableMealSlot,
  ): string {
    return `${dietType}:${week}:${dayNumber}:${mealSlot}`;
  }

  private resolveWorkoutDayStateKey(week: PlanWeek, dayNumber: number): string {
    return `${week}:${dayNumber}`;
  }

  private createEmptyMealState(): DietPlanDayMealState {
    return {
      breakfast: false,
      snack1: false,
      lunch: false,
      dinner: false,
      snack2: false,
      supplements: false,
    };
  }

  private buildDietPlanWithMealStates(
    dietPlan: DietPlan,
    dietType: DietType,
    week: PlanWeek,
  ): DietPlan {
    return {
      ...dietPlan,
      days: dietPlan.days.map((day) => ({
        ...day,
        eatenMeals: {
          ...this.createEmptyMealState(),
          breakfast: this.getDietPlanMealEatenState(dietType, week, day.day, "breakfast") ?? false,
          snack1: this.getDietPlanMealEatenState(dietType, week, day.day, "snack1") ?? false,
          lunch: this.getDietPlanMealEatenState(dietType, week, day.day, "lunch") ?? false,
          dinner: this.getDietPlanMealEatenState(dietType, week, day.day, "dinner") ?? false,
          snack2: this.getDietPlanMealEatenState(dietType, week, day.day, "snack2") ?? false,
          supplements: this.getDietPlanMealEatenState(dietType, week, day.day, "supplements") ?? false,
        },
      })),
    };
  }

  private buildWorkoutPlanWithCompletionState(workoutPlan: WorkoutPlan, week: PlanWeek): WorkoutPlan {
    return {
      ...workoutPlan,
      days: workoutPlan.days.map((day) => ({
        ...day,
        completed: this.getWorkoutPlanCompletionState(week, day.day) ?? false,
      })),
    };
  }

  async addNewUser(user: CreateUserRecordCommand): Promise<void> {
    const storedUser: DataUserCommand = {
      id: user.id,
      name: "",
      age: 0,
      gender: "",
      weight: 0,
      height: 0,
      goal: "",
      diet: "",
      kindOfDiet: "",
      avoidedFoods: [],
      allergies: [],
      levelActivity: "",
      trainLocation: "",
      timeToTrain: 0,
      injuries: [],
      favoriteFoods: [],
      supplementation: [],
      numberOfMeals: 0,
      energyUnitPreference: "kj",
      caloriesTarget: 0,
      kilojoulesTarget: 0,
      proteinTarget: 0,
      carbsTarget: 0,
      fatsTarget: 0,
      favorieteCoucineRecipes: [],
      isPro: user.isPro,
    };

    this.usersById.set(user.id, storedUser);
    this.credentialsByEmail.set(user.email, {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      isPro: user.isPro,
      googleSub: null,
    });
  }

  async saveDataUser(_dataUserCommand: DataUserCommand): Promise<void> {}

  async getDataUser(query: GetDataUserQuery): Promise<DataUserCommand | null> {
    return this.usersById.get(query.id) ?? null;
  }

  async getAllUsers(): Promise<DataUserCommand[]> {
    return Array.from(this.usersById.values());
  }

  async saveDietPlan(
    userId: string,
    dietPlan: DietPlan,
    dietType: "recipes" | "single-food",
    options?: SaveDietPlanOptions,
  ): Promise<DietPlan> {
    const week = options?.week ?? "current";
    this.dietPlans.set(this.resolveDietKey(dietType, week), dietPlan);
    for (const day of dietPlan.days) {
      for (const mealSlot of ["breakfast", "snack1", "lunch", "dinner", "snack2", "supplements"] as const) {
        this.dietMealEatenStates.set(
          this.resolveDietDayStateKey(dietType, week, day.day, mealSlot),
          false,
        );
      }
    }

    if (week === "current" && options?.activateDietType !== false) {
      const currentUser = this.usersById.get(userId);

      if (currentUser) {
        this.usersById.set(userId, {
          ...currentUser,
          kindOfDiet: dietType,
        });
      }
    }

    return dietPlan;
  }

  async getDietPlan(
    userId: string,
    options?: PlanSelectionOptions,
  ): Promise<DietPlan | null> {
    const currentUser = this.usersById.get(userId);
    const dietType = options?.dietType ?? (currentUser?.kindOfDiet === "single-food" ? "single-food" : "recipes");
    const week = options?.week ?? "current";
    const plan = this.dietPlans.get(this.resolveDietKey(dietType, week)) ?? null;

    return plan ? this.buildDietPlanWithMealStates(plan, dietType, week) : null;
  }

  async saveWorkoutPlan(
    _userId: string,
    workoutPlan: WorkoutPlan,
    options?: { week?: PlanWeek },
  ): Promise<WorkoutPlan> {
    const week = options?.week ?? "current";
    this.workoutPlans.set(week, workoutPlan);
    for (const day of workoutPlan.days) {
      this.workoutDayCompletionStates.set(this.resolveWorkoutDayStateKey(week, day.day), false);
    }
    return workoutPlan;
  }

  async getWorkoutPlan(_userId: string, options?: PlanSelectionOptions): Promise<WorkoutPlan | null> {
    const week = options?.week ?? "current";
    const workoutPlan = this.workoutPlans.get(week) ?? null;

    return workoutPlan ? this.buildWorkoutPlanWithCompletionState(workoutPlan, week) : null;
  }

  async saveShoppingList(
    _userId: string,
    shoppingList: ShoppingList,
    dietType: DietType,
    week: PlanWeek = "current",
  ): Promise<ShoppingList> {
    this.shoppingLists.set(this.resolveDietKey(dietType, week), shoppingList);
    return shoppingList;
  }

  async getShoppingList(
    userId: string,
    options?: PlanSelectionOptions,
  ): Promise<ShoppingList | null> {
    const currentUser = this.usersById.get(userId);
    const dietType = options?.dietType ?? (currentUser?.kindOfDiet === "single-food" ? "single-food" : "recipes");
    const week = options?.week ?? "current";

    return this.shoppingLists.get(this.resolveDietKey(dietType, week)) ?? null;
  }

  async toggleShoppingListItem(
    userId: string,
    itemId: string,
    checked: boolean,
    options?: PlanSelectionOptions,
  ): Promise<ShoppingList> {
    const currentUser = this.usersById.get(userId);
    const dietType = options?.dietType ?? (currentUser?.kindOfDiet === "single-food" ? "single-food" : "recipes");
    const week = options?.week ?? "current";
    const shoppingList = this.shoppingLists.get(this.resolveDietKey(dietType, week));

    if (!shoppingList) {
      throw new Error("Shopping list not found.");
    }

    const updateItems = (items: ShoppingList["categories"][keyof ShoppingList["categories"]]) => (
      items.map((item) => (
        item.id === itemId || item.item.toLowerCase().replace(/[^a-z0-9]+/g, "-") === itemId
          ? { ...item, id: item.id ?? itemId, checked }
          : item
      ))
    );

    const updatedShoppingList: ShoppingList = {
      ...shoppingList,
      categories: {
        proteins: updateItems(shoppingList.categories.proteins),
        produce: updateItems(shoppingList.categories.produce),
        pantry: updateItems(shoppingList.categories.pantry),
        dairy: updateItems(shoppingList.categories.dairy),
        frozen: updateItems(shoppingList.categories.frozen),
        beverages: updateItems(shoppingList.categories.beverages),
      },
      byStoreSection: shoppingList.byStoreSection.map((section) => ({
        ...section,
        items: updateItems(section.items),
      })),
    };

    this.shoppingLists.set(this.resolveDietKey(dietType, week), updatedShoppingList);

    return updatedShoppingList;
  }

  async saveUserProgressDay(progressDay: UserProgressDay): Promise<UserProgressDay> {
    this.progressDays.set(`${progressDay.userId}:${progressDay.date}`, progressDay);
    return progressDay;
  }

  async syncDietPlanMealEatenState(
    _userId: string,
    dietType: DietType,
    dayNumber: number,
    mealSlot: TrackableMealSlot,
    eaten: boolean,
    week: PlanWeek = "current",
  ): Promise<void> {
    const plan = this.dietPlans.get(this.resolveDietKey(dietType, week));

    if (plan) {
      this.dietMealEatenStates.set(
        this.resolveDietDayStateKey(dietType, week, dayNumber, mealSlot),
        eaten,
      );
    }
  }

  async syncWorkoutPlanDayCompletionState(
    _userId: string,
    dayNumber: number,
    completed: boolean,
    week: PlanWeek = "current",
  ): Promise<void> {
    this.workoutDayCompletionStates.set(this.resolveWorkoutDayStateKey(week, dayNumber), completed);
  }

  async getUserProgressDay(
    userId: string,
    date: string,
  ): Promise<UserProgressDay | null> {
    return this.progressDays.get(`${userId}:${date}`) ?? null;
  }

  async listUserProgressDays(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<UserProgressDay[]> {
    return Array.from(this.progressDays.values())
      .filter((progressDay) => (
        progressDay.userId === userId
        && progressDay.date >= startDate
        && progressDay.date <= endDate
      ))
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  async saveUserTrackingEntry(entry: UserTrackingEntry): Promise<UserTrackingEntry> {
    this.trackingEntries.set(`${entry.userId}:${entry.date}`, entry);
    return entry;
  }

  async listUserTrackingEntries(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<UserTrackingEntry[]> {
    return Array.from(this.trackingEntries.values())
      .filter((entry) => (
        entry.userId === userId
        && entry.date >= startDate
        && entry.date <= endDate
      ))
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  async saveUserWaterEntry(entry: UserWaterEntry): Promise<UserWaterEntry> {
    this.waterEntries.set(`${entry.userId}:${entry.date}`, entry);
    return entry;
  }

  async listUserWaterEntries(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<UserWaterEntry[]> {
    return Array.from(this.waterEntries.values())
      .filter((entry) => (
        entry.userId === userId
        && entry.date >= startDate
        && entry.date <= endDate
      ))
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  async replaceUserExerciseLogs(
    userId: string,
    date: string,
    logs: UserExerciseLogInput[],
  ): Promise<UserExerciseLog[]> {
    const key = `${userId}:${date}`;
    const normalized = logs.map((log) => ({
      userId,
      date,
      exerciseName: log.exerciseName,
      setsCompleted: Math.round(log.setsCompleted),
      repsCompleted: Math.round(log.repsCompleted),
      weightUsed: Math.round(log.weightUsed * 100) / 100,
      volume: Math.round(log.setsCompleted * log.repsCompleted * log.weightUsed * 100) / 100,
    }));

    if (normalized.length === 0) {
      this.exerciseLogs.delete(key);
      return [];
    }

    this.exerciseLogs.set(key, normalized);
    return normalized;
  }

  async listUserExerciseLogs(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<UserExerciseLog[]> {
    return Array.from(this.exerciseLogs.values())
      .flat()
      .filter((entry) => (
        entry.userId === userId
        && entry.date >= startDate
        && entry.date <= endDate
      ))
      .sort((left, right) => (
        left.date === right.date
          ? left.exerciseName.localeCompare(right.exerciseName)
          : left.date.localeCompare(right.date)
      ));
  }

  async getUserCredentialsByEmail(
    query: GetUserCredentialsByEmailQuery,
  ): Promise<UserCredentials | null> {
    return this.credentialsByEmail.get(query.email) ?? null;
  }

  async saveUserGoogleSub(userId: string, googleSub: string): Promise<void> {
    const currentUser = this.usersById.get(userId);

    if (!currentUser) {
      return;
    }

    const credential = Array.from(this.credentialsByEmail.values())
      .find((item) => item.id === userId);

    if (!credential) {
      return;
    }

    this.credentialsByEmail.set(credential.email, {
      ...credential,
      googleSub,
    });
  }

  getDietPlanMealEatenState(
    dietType: DietType,
    week: PlanWeek,
    dayNumber: number,
    mealSlot: TrackableMealSlot,
  ): boolean | undefined {
    return this.dietMealEatenStates.get(this.resolveDietDayStateKey(dietType, week, dayNumber, mealSlot));
  }

  getWorkoutPlanCompletionState(week: PlanWeek, dayNumber: number): boolean | undefined {
    return this.workoutDayCompletionStates.get(this.resolveWorkoutDayStateKey(week, dayNumber));
  }
}

const sampleUser: DataUserCommand = {
  id: "user-1",
  name: "Carlos Mendez",
  age: 28,
  gender: "male",
  weight: 75,
  height: 178,
  goal: "muscle-gain",
  diet: "omnivore",
  kindOfDiet: "recipes",
  avoidedFoods: ["pork"],
  allergies: ["peanuts"],
  levelActivity: "moderate",
  trainLocation: "gym",
  timeToTrain: 60,
  numberOfMeals: 4,
  energyUnitPreference: "kj",
  caloriesTarget: 2978,
  kilojoulesTarget: 12460,
  proteinTarget: 223,
  carbsTarget: 335,
  fatsTarget: 83,
  injuries: ["shoulder discomfort"],
  favoriteFoods: ["chicken", "rice"],
  supplementation: ["creatine", "whey protein"],
  favorieteCoucineRecipes: ["latin", "mediterranean"],
  isPro: false,
};

const sampleWorkoutPlan: WorkoutPlan = {
  overview: {
    split: "Upper / Lower",
    avgDuration: "60 min",
    estimatedWeeklyCaloriesBurned: 2450,
    estimatedWeeklyKilojoulesBurned: 10251,
  },
  days: Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    dayName: `Day ${index + 1}`,
    focus: "Full Body",
    totalDuration: "60 min",
    estimatedCaloriesBurned: 350,
    estimatedKilojoulesBurned: 1464,
    exercises: [
      {
        name: "Goblet Squat",
        sets: "3",
        reps: "10",
        rest: "60 sec",
      },
    ],
  })),
};

const sampleDietPlan: DietPlan = {
  summary: {
    dailyCalories: 2400,
    macros: {
      protein: "180g",
      carbs: "250g",
      fats: "70g",
    },
    cuisines: ["latin", "mediterranean"],
  },
  days: Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    dayName: `Day ${index + 1}`,
    breakfast: {
      object: "Egg breakfast bowl",
      description: "Eggs, oats, and berries.",
      quantity: 320,
      quantityUnit: "g",
      ingredients: [
        { item: "Eggs", quantity: 150, quantityUnit: "g" },
        { item: "Oats", quantity: 80, quantityUnit: "g" },
        { item: "Banana", quantity: 90, quantityUnit: "g" },
      ],
      macros: {
        protein: "30g",
        carbs: "35g",
        fats: "12g",
      },
      calories: 380,
      kilojoules: 1590,
    },
    snack1: {
      object: "Greek yogurt snack",
      description: "Greek yogurt with banana.",
      quantity: 220,
      quantityUnit: "g",
      ingredients: [
        { item: "Greek yogurt", quantity: 170, quantityUnit: "g" },
        { item: "Banana", quantity: 50, quantityUnit: "g" },
      ],
      macros: {
        protein: "20g",
        carbs: "22g",
        fats: "4g",
      },
      calories: 210,
      kilojoules: 879,
    },
    lunch: {
      object: "Chicken rice bowl",
      description: "Chicken, rice, avocado, vegetables.",
      quantity: 480,
      quantityUnit: "g",
      ingredients: [
        { item: "Chicken breast", quantity: 180, quantityUnit: "g" },
        { item: "Rice", quantity: 200, quantityUnit: "g" },
        { item: "Avocado", quantity: 50, quantityUnit: "g" },
        { item: "Vegetables", quantity: 50, quantityUnit: "g" },
      ],
      macros: {
        protein: "45g",
        carbs: "60g",
        fats: "18g",
      },
      calories: 620,
      kilojoules: 2594,
    },
    dinner: {
      object: "Salmon potatoes plate",
      description: "Salmon with potatoes and salad.",
      quantity: 430,
      quantityUnit: "g",
      ingredients: [
        { item: "Salmon", quantity: 180, quantityUnit: "g" },
        { item: "Potatoes", quantity: 180, quantityUnit: "g" },
        { item: "Salad greens", quantity: 70, quantityUnit: "g" },
      ],
      macros: {
        protein: "42g",
        carbs: "40g",
        fats: "20g",
      },
      calories: 560,
      kilojoules: 2343,
    },
    snack2: {
      object: "Protein shake",
      description: "Whey with milk and berries.",
      quantity: 400,
      quantityUnit: "ml",
      ingredients: [
        { item: "Whey protein", quantity: 30, quantityUnit: "g" },
        { item: "Milk", quantity: 250, quantityUnit: "ml" },
        { item: "Berries", quantity: 120, quantityUnit: "g" },
      ],
      macros: {
        protein: "28g",
        carbs: "18g",
        fats: "6g",
      },
      calories: 250,
      kilojoules: 1046,
    },
    supplements: [
      {
        object: "Creatine monohydrate",
        description: "5g daily with water.",
        quantity: 5,
        quantityUnit: "g",
        ingredients: [
          { item: "Creatine monohydrate", quantity: 5, quantityUnit: "g" },
        ],
        macros: {
          protein: "0g",
          carbs: "0g",
          fats: "0g",
        },
        calories: 0,
        kilojoules: 0,
      },
    ],
  })),
};

const sampleCompletePlan: CompletePlanResult = {
  userId: sampleUser.id,
  generatedAt: new Date().toISOString(),
  dietPlan: sampleDietPlan,
  workoutPlan: sampleWorkoutPlan,
  shoppingList: {
    metadata: {
      totalItems: 4,
      estimatedCost: 45,
      storeSections: 3,
      prepTime: "45 min",
      daysCovered: 7,
    },
    categories: {
      proteins: [
        { item: "Chicken Breast", quantity: 1400, quantityUnit: "gr" },
      ],
      produce: [
        { item: "Banana", quantity: 700, quantityUnit: "gr" },
      ],
      pantry: [
        { item: "Oats", quantity: 560, quantityUnit: "gr" },
      ],
      dairy: [],
      frozen: [],
      beverages: [
        { item: "Milk", quantity: 1750, quantityUnit: "ml" },
      ],
    },
    byStoreSection: [
      {
        section: "Proteins",
        items: [
          { item: "Chicken Breast", quantity: 1400, quantityUnit: "gr" },
        ],
      },
    ],
    mealPrepStrategy: {
      batchCookItems: [],
      prepOrder: ["Proteins", "Vegetables"],
      storageInstructions: [],
      equipmentNeeded: ["Containers"],
    },
    pantryChecklist: [],
    costOptimizations: [],
  },
  errors: [],
};

const sessionTokenService = new SessionTokenService();
const fixedNow = new Date("2026-03-02T12:00:00");

before(() => {
  mock.timers.enable({ apis: ["Date"], now: fixedNow });
});

after(() => {
  mock.timers.reset();
});

const createAuthHeaders = (
  additionalHeaders: Record<string, string> = {},
): Record<string, string> => ({
  Authorization: `Bearer ${sessionTokenService.issueSession(sampleUser, {
    email: "carlos@example.com",
    provider: "password",
  }).token}`,
  ...additionalHeaders,
});

const createTestServer = (
  repositoryUser = new RepositoryUserMock(
    sampleUser,
    sampleDietPlan,
    sampleWorkoutPlan,
  ),
) => {
  const userHandler = new UserHandler(repositoryUser);
  const workoutsHandler = new WorkoutsHandler(
    repositoryUser,
    async (): Promise<ApiResponse<WorkoutPlan>> => ({
      success: true,
      data: sampleWorkoutPlan,
    }),
  );
  const dietHandler = new DietHandler(
    repositoryUser,
    async (): Promise<ApiResponse<DietPlan>> => ({
      success: true,
      data: sampleDietPlan,
    }),
  );
  const userPlanHandler = new UserPlanHandler(
    repositoryUser,
    async (): Promise<CompletePlanResult> => sampleCompletePlan,
  );
  const progressHandler = new ProgressHandler(repositoryUser);
  const shoppingListHandler = new ShoppingListHandler(repositoryUser);
  const authHandler = new AuthHandler(repositoryUser);

  return createServer({
    authHandler,
    userHandler,
    userPlanHandler,
    dietHandler,
    workoutsHandler,
    progressHandler,
    shoppingListHandler,
  });
};

const withRunningServer = async (
  callback: (baseUrl: string, repositoryUser: RepositoryUserMock) => Promise<void>,
  repositoryUser = new RepositoryUserMock(
    sampleUser,
    sampleDietPlan,
    sampleWorkoutPlan,
  ),
): Promise<void> => {
  const app = createTestServer(repositoryUser);
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl, repositoryUser);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
};

test("POST /workouts/users/:id/plan returns the generated workout plan", async () => {
  await withRunningServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/workouts/users/${sampleUser.id}/plan`, {
      method: "POST",
      headers: createAuthHeaders(),
    });

    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.overview.split, sampleWorkoutPlan.overview.split);
    assert.equal(payload.days.length, 7);

    const storedResponse = await fetch(`${baseUrl}/workouts/users/${sampleUser.id}/plan`, {
      headers: createAuthHeaders(),
    });
    assert.equal(storedResponse.status, 200);

    const storedPayload = await storedResponse.json();
    assert.equal(storedPayload.days.length, 7);
    assert.equal(storedPayload.days[0].focus, sampleWorkoutPlan.days[0].focus);
  });
});

test("POST /auth/register and /auth/login create secure sessions", async () => {
  await withRunningServer(async (baseUrl) => {
    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "new.member@example.com",
        password: "strong-pass-123",
      }),
    });

    assert.equal(registerResponse.status, 201);
    const registerPayload = await registerResponse.json();
    assert.equal(typeof registerPayload.token, "string");
    assert.equal(registerPayload.account.email, "new.member@example.com");

    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "new.member@example.com",
        password: "strong-pass-123",
      }),
    });

    assert.equal(loginResponse.status, 200);
    const loginPayload = await loginResponse.json();
    assert.equal(typeof loginPayload.token, "string");
    assert.equal(loginPayload.account.provider, "password");
  });
});

test("OPTIONS /auth/login returns CORS headers for the frontend", async () => {
  await withRunningServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,authorization",
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.match(response.headers.get("access-control-allow-methods") ?? "", /POST/);
    assert.match(response.headers.get("access-control-allow-headers") ?? "", /Authorization/i);
  });
});

test("POST /diets/users/:id/plan returns the generated diet plan", async () => {
  await withRunningServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/diets/users/${sampleUser.id}/plan`, {
      method: "POST",
      headers: createAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        dietType: "recipes",
      }),
    });

    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.summary.dailyCalories, sampleDietPlan.summary.dailyCalories);
    assert.equal(payload.days.length, 7);

    const storedResponse = await fetch(`${baseUrl}/diets/users/${sampleUser.id}/plan`, {
      headers: createAuthHeaders(),
    });
    assert.equal(storedResponse.status, 200);

    const storedPayload = await storedResponse.json();
    assert.equal(storedPayload.days.length, 7);
    assert.equal(storedPayload.days[0].breakfast.object, sampleDietPlan.days[0].breakfast.object);
  });
});

test("POST /users/:id/complete-plan returns the generated full plan", async () => {
  await withRunningServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/users/${sampleUser.id}/complete-plan`, {
      method: "POST",
      headers: createAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        dietType: "recipes",
      }),
    });

    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.userId, sampleCompletePlan.userId);
    assert.equal(payload.dietPlan.days.length, 7);
    assert.equal(payload.workoutPlan.days.length, 7);
    assert.equal(payload.shoppingList.metadata.totalItems, 4);

    const storedDietResponse = await fetch(`${baseUrl}/diets/users/${sampleUser.id}/plan`, {
      headers: createAuthHeaders(),
    });
    assert.equal(storedDietResponse.status, 200);

    const storedWorkoutResponse = await fetch(`${baseUrl}/workouts/users/${sampleUser.id}/plan`, {
      headers: createAuthHeaders(),
    });
    assert.equal(storedWorkoutResponse.status, 200);

    const storedShoppingResponse = await fetch(`${baseUrl}/shopping/users/${sampleUser.id}/list`, {
      headers: createAuthHeaders(),
    });
    assert.equal(storedShoppingResponse.status, 200);

    const storedShoppingPayload = await storedShoppingResponse.json();
    assert.equal(storedShoppingPayload.metadata.daysCovered, 7);
    assert.equal(storedShoppingPayload.categories.beverages[0].quantityUnit, "ml");
  });
});

test("PUT /progress/users/:id/meals/:mealSlot and /workout track daily energy totals", async () => {
  await withRunningServer(async (baseUrl, repositoryUser) => {
    const breakfastResponse = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/meals/breakfast`,
      {
        method: "PUT",
        headers: createAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          date: "2026-03-02",
        }),
      },
    );

    assert.equal(breakfastResponse.status, 200);

    const breakfastPayload = await breakfastResponse.json();
    assert.equal(breakfastPayload.meals.breakfast.completed, true);
    assert.equal(breakfastPayload.totals.caloriesConsumed, 380);
    assert.equal(breakfastPayload.totals.kilojoulesConsumed, 1590);
    assert.equal(repositoryUser.getDietPlanMealEatenState("recipes", "current", 1, "breakfast"), true);

    const workoutResponse = await fetch(`${baseUrl}/progress/users/${sampleUser.id}/workout`, {
      method: "PUT",
      headers: createAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        date: "2026-03-02",
      }),
    });

    assert.equal(workoutResponse.status, 200);

    const workoutPayload = await workoutResponse.json();
    assert.equal(workoutPayload.workout.completed, true);
    assert.equal(workoutPayload.totals.caloriesBurned, 350);
    assert.equal(workoutPayload.totals.kilojoulesBurned, 1464);
    assert.equal(workoutPayload.totals.netCalories, 30);
    assert.equal(repositoryUser.getWorkoutPlanCompletionState("current", 1), true);

    const storedWorkoutResponse = await fetch(`${baseUrl}/workouts/users/${sampleUser.id}/plan`, {
      headers: createAuthHeaders(),
    });
    assert.equal(storedWorkoutResponse.status, 200);

    const storedWorkoutPayload = await storedWorkoutResponse.json();
    assert.equal(storedWorkoutPayload.days[0].completed, true);
    assert.equal(storedWorkoutPayload.days[1].completed, false);

    const dayResponse = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/day?date=2026-03-02`,
      {
        headers: createAuthHeaders(),
      },
    );
    assert.equal(dayResponse.status, 200);

    const dayPayload = await dayResponse.json();
    assert.equal(dayPayload.date, "2026-03-02");
    assert.equal(dayPayload.totals.mealsCompleted, 1);
    assert.equal(dayPayload.totals.workoutsCompleted, 1);

    const summaryResponse = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/summary?period=month&date=2026-03-02`,
      {
        headers: createAuthHeaders(),
      },
    );
    assert.equal(summaryResponse.status, 200);

    const summaryPayload = await summaryResponse.json();
    assert.equal(summaryPayload.totals.trackedDays, 1);
    assert.equal(summaryPayload.totals.caloriesConsumed, 380);
    assert.equal(summaryPayload.totals.caloriesBurned, 350);
    assert.equal(summaryPayload.breakdown.length, 1);
    assert.equal(summaryPayload.breakdown[0].label, "2026-03-02");
  });
});

test("GET /progress/users/:id/tracking and /exercise-logs return the persisted daily tracking tables", async () => {
  await withRunningServer(async (baseUrl) => {
    const requestHeaders = createAuthHeaders({
      "Content-Type": "application/json",
    });

    const mealResponse = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/meals/breakfast`,
      {
        method: "PUT",
        headers: requestHeaders,
        body: JSON.stringify({
          date: "2026-03-02",
          completed: true,
        }),
      },
    );
    assert.equal(mealResponse.status, 200);

    const workoutResponse = await fetch(`${baseUrl}/progress/users/${sampleUser.id}/workout`, {
      method: "PUT",
      headers: requestHeaders,
      body: JSON.stringify({
        date: "2026-03-02",
        completed: true,
        exerciseLogs: [
          {
            exerciseName: "Goblet Squat",
            setsCompleted: 3,
            repsCompleted: 10,
            weightUsed: 24.5,
          },
        ],
      }),
    });
    assert.equal(workoutResponse.status, 200);

    const trackingResponse = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/tracking?startDate=2026-03-02&endDate=2026-03-02`,
      {
        headers: createAuthHeaders(),
      },
    );
    assert.equal(trackingResponse.status, 200);

    const trackingPayload = await trackingResponse.json();
    assert.equal(trackingPayload.length, 1);
    assert.equal(trackingPayload[0].date, "2026-03-02");
    assert.equal(trackingPayload[0].kjsConsumed, 1590);
    assert.deepEqual(trackingPayload[0].macrosConsumed, {
      proteinGrams: 30,
      carbsGrams: 35,
      fatsGrams: 12,
    });
    assert.equal(trackingPayload[0].kjsTarget, 8452);
    assert.deepEqual(trackingPayload[0].macrosTarget, {
      proteinGrams: 165,
      carbsGrams: 175,
      fatsGrams: 60,
    });
    assert.equal(trackingPayload[0].kjsBurned, 1464);
    assert.equal(trackingPayload[0].kjsBurnedTarget, 1464);

    const exerciseLogsResponse = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/exercise-logs?startDate=2026-03-02&endDate=2026-03-02`,
      {
        headers: createAuthHeaders(),
      },
    );
    assert.equal(exerciseLogsResponse.status, 200);

    const exerciseLogsPayload = await exerciseLogsResponse.json();
    assert.equal(exerciseLogsPayload.length, 1);
    assert.equal(exerciseLogsPayload[0].exerciseName, "Goblet Squat");
    assert.equal(exerciseLogsPayload[0].weightUsed, 24.5);
    assert.equal(exerciseLogsPayload[0].volume, 735);

    const clearWorkoutResponse = await fetch(`${baseUrl}/progress/users/${sampleUser.id}/workout`, {
      method: "PUT",
      headers: requestHeaders,
      body: JSON.stringify({
        date: "2026-03-02",
        completed: false,
      }),
    });
    assert.equal(clearWorkoutResponse.status, 200);

    const clearedExerciseLogsResponse = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/exercise-logs?startDate=2026-03-02&endDate=2026-03-02`,
      {
        headers: createAuthHeaders(),
      },
    );
    assert.equal(clearedExerciseLogsResponse.status, 200);

    const clearedExerciseLogsPayload = await clearedExerciseLogsResponse.json();
    assert.deepEqual(clearedExerciseLogsPayload, []);
  });
});

test("GET/PUT /progress/users/:id/water returns the water target and persists clicked glasses", async () => {
  await withRunningServer(async (baseUrl) => {
    const requestHeaders = createAuthHeaders({
      "Content-Type": "application/json",
    });

    const initialResponse = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/water?startDate=2026-03-02&endDate=2026-03-02`,
      {
        headers: createAuthHeaders(),
      },
    );
    assert.equal(initialResponse.status, 200);

    const initialPayload = await initialResponse.json();
    assert.equal(initialPayload.length, 1);
    assert.equal(initialPayload[0].targetGlasses, 4);
    assert.equal(initialPayload[0].glassesCompleted, 0);

    const updateResponse = await fetch(`${baseUrl}/progress/users/${sampleUser.id}/water`, {
      method: "PUT",
      headers: requestHeaders,
      body: JSON.stringify({
        date: "2026-03-02",
        glassesCompleted: 3,
      }),
    });
    assert.equal(updateResponse.status, 200);

    const updatePayload = await updateResponse.json();
    assert.equal(updatePayload.targetGlasses, 4);
    assert.equal(updatePayload.glassesCompleted, 3);
    assert.equal(updatePayload.completedLiters, 3);

    const refreshedResponse = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/water?startDate=2026-03-02&endDate=2026-03-02`,
      {
        headers: createAuthHeaders(),
      },
    );
    assert.equal(refreshedResponse.status, 200);

    const refreshedPayload = await refreshedResponse.json();
    assert.equal(refreshedPayload[0].glassesCompleted, 3);
  });
});

test("PUT /progress/users/:id/meals/:mealSlot blocks dates outside the active day", async () => {
  await withRunningServer(async (baseUrl) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const futureDate = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, "0"),
      String(tomorrow.getDate()).padStart(2, "0"),
    ].join("-");
    const response = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/meals/breakfast`,
      {
        method: "PUT",
        headers: createAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          date: futureDate,
          completed: true,
        }),
      },
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.message, "Meals and workouts can only be marked on today's date.");
  });
});

test("PUT /progress/users/:id/meals/:mealSlot with completed=false removes tracked meal energy", async () => {
  await withRunningServer(async (baseUrl, repositoryUser) => {
    const requestOptions = {
      method: "PUT",
      headers: createAuthHeaders({
        "Content-Type": "application/json",
      }),
    };

    const addResponse = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/meals/breakfast`,
      {
        ...requestOptions,
        body: JSON.stringify({
          date: "2026-03-02",
          completed: true,
        }),
      },
    );
    assert.equal(addResponse.status, 200);

    const removeResponse = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/meals/breakfast`,
      {
        ...requestOptions,
        body: JSON.stringify({
          date: "2026-03-02",
          completed: false,
        }),
      },
    );
    assert.equal(removeResponse.status, 200);

    const payload = await removeResponse.json();
    assert.equal(payload.meals.breakfast.completed, false);
    assert.equal(payload.totals.caloriesConsumed, 0);
    assert.equal(payload.totals.kilojoulesConsumed, 0);
    assert.equal(payload.totals.mealsCompleted, 0);
    assert.equal(repositoryUser.getDietPlanMealEatenState("recipes", "current", 1, "breakfast"), false);
  });
});

test("PUT /progress/users/:id/meals/:mealSlot uses the selected diet table when dietType is provided", async () => {
  const alternateRepository = new RepositoryUserMock(sampleUser, sampleDietPlan, sampleWorkoutPlan);
  const singleFoodPlan: DietPlan = JSON.parse(JSON.stringify(sampleDietPlan));
  singleFoodPlan.days[0].breakfast.object = "Single food breakfast";
  singleFoodPlan.days[0].breakfast.calories = 510;
  singleFoodPlan.days[0].breakfast.kilojoules = 2134;
  await alternateRepository.saveDietPlan(sampleUser.id, singleFoodPlan, "single-food", {
    activateDietType: false,
  });

  await withRunningServer(async (baseUrl, repositoryUser) => {
    const response = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/meals/breakfast`,
      {
        method: "PUT",
        headers: createAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          date: "2026-03-02",
          dietType: "single-food",
          completed: true,
        }),
      },
    );

    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.meals.breakfast.completed, true);
    assert.equal(payload.totals.caloriesConsumed, 510);
    assert.equal(payload.totals.kilojoulesConsumed, 2134);
    assert.equal(repositoryUser.getDietPlanMealEatenState("single-food", "current", 1, "breakfast"), true);
    assert.equal(repositoryUser.getDietPlanMealEatenState("recipes", "current", 1, "breakfast"), false);
  }, alternateRepository);
});

test("PUT /progress/users/:id/meals/:mealSlot accumulates more than one meal on the same day", async () => {
  await withRunningServer(async (baseUrl) => {
    const requestHeaders = createAuthHeaders({
      "Content-Type": "application/json",
    });

    const breakfastResponse = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/meals/breakfast`,
      {
        method: "PUT",
        headers: requestHeaders,
        body: JSON.stringify({
          date: "2026-03-02",
          completed: true,
        }),
      },
    );
    assert.equal(breakfastResponse.status, 200);

    const lunchResponse = await fetch(
      `${baseUrl}/progress/users/${sampleUser.id}/meals/lunch`,
      {
        method: "PUT",
        headers: requestHeaders,
        body: JSON.stringify({
          date: "2026-03-02",
          completed: true,
        }),
      },
    );
    assert.equal(lunchResponse.status, 200);

    const payload = await lunchResponse.json();
    assert.equal(payload.meals.breakfast.completed, true);
    assert.equal(payload.meals.lunch.completed, true);
    assert.equal(payload.totals.mealsCompleted, 2);
    assert.equal(payload.totals.caloriesConsumed, 1000);
    assert.equal(payload.totals.kilojoulesConsumed, 4184);
  });
});

test("PUT /shopping/users/:id/items/:itemId persists market-list checkoff", async () => {
  await withRunningServer(async (baseUrl) => {
    const requestHeaders = createAuthHeaders({
      "Content-Type": "application/json",
    });

    const generateResponse = await fetch(`${baseUrl}/users/${sampleUser.id}/complete-plan`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({
        dietType: "recipes",
      }),
    });
    assert.equal(generateResponse.status, 200);

    const toggleResponse = await fetch(
      `${baseUrl}/shopping/users/${sampleUser.id}/items/chicken-breast`,
      {
        method: "PUT",
        headers: requestHeaders,
        body: JSON.stringify({
          checked: true,
        }),
      },
    );
    assert.equal(toggleResponse.status, 200);

    const togglePayload = await toggleResponse.json();
    assert.equal(togglePayload.categories.proteins[0].checked, true);

    const storedResponse = await fetch(`${baseUrl}/shopping/users/${sampleUser.id}/list`, {
      headers: createAuthHeaders(),
    });
    assert.equal(storedResponse.status, 200);

    const storedPayload = await storedResponse.json();
    assert.equal(storedPayload.categories.proteins[0].checked, true);
  });
});
