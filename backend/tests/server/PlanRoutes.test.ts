import test from "node:test";
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
  ShoppingList,
  UserProgressDay,
  WorkoutPlan,
} from "../../src/types";

class RepositoryUserMock implements RepositoryUser {
  private dietPlan: DietPlan | null = null;
  private workoutPlan: WorkoutPlan | null = null;
  private shoppingList: ShoppingList | null = null;
  private readonly progressDays = new Map<string, UserProgressDay>();
  private readonly usersById = new Map<string, DataUserCommand>();
  private readonly credentialsByEmail = new Map<string, UserCredentials>();

  constructor(
    private readonly user: DataUserCommand | null,
    dietPlan: DietPlan | null = null,
    workoutPlan: WorkoutPlan | null = null,
  ) {
    this.dietPlan = dietPlan;
    this.workoutPlan = workoutPlan;

    if (user) {
      this.usersById.set(user.id, user);
    }
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
    _userId: string,
    dietPlan: DietPlan,
    _dietType: "recipes" | "single-food",
  ): Promise<DietPlan> {
    this.dietPlan = dietPlan;
    return dietPlan;
  }

  async getDietPlan(_userId: string): Promise<DietPlan | null> {
    return this.dietPlan;
  }

  async saveWorkoutPlan(
    _userId: string,
    workoutPlan: WorkoutPlan,
  ): Promise<WorkoutPlan> {
    this.workoutPlan = workoutPlan;
    return workoutPlan;
  }

  async getWorkoutPlan(_userId: string): Promise<WorkoutPlan | null> {
    return this.workoutPlan;
  }

  async saveShoppingList(
    _userId: string,
    shoppingList: ShoppingList,
  ): Promise<ShoppingList> {
    this.shoppingList = shoppingList;
    return shoppingList;
  }

  async getShoppingList(_userId: string): Promise<ShoppingList | null> {
    return this.shoppingList;
  }

  async toggleShoppingListItem(
    _userId: string,
    itemId: string,
    checked: boolean,
  ): Promise<ShoppingList> {
    if (!this.shoppingList) {
      throw new Error("Shopping list not found.");
    }

    const updateItems = (items: ShoppingList["categories"][keyof ShoppingList["categories"]]) => (
      items.map((item) => (
        item.id === itemId || item.item.toLowerCase().replace(/[^a-z0-9]+/g, "-") === itemId
          ? { ...item, id: item.id ?? itemId, checked }
          : item
      ))
    );

    this.shoppingList = {
      ...this.shoppingList,
      categories: {
        proteins: updateItems(this.shoppingList.categories.proteins),
        produce: updateItems(this.shoppingList.categories.produce),
        pantry: updateItems(this.shoppingList.categories.pantry),
        dairy: updateItems(this.shoppingList.categories.dairy),
        frozen: updateItems(this.shoppingList.categories.frozen),
        beverages: updateItems(this.shoppingList.categories.beverages),
      },
      byStoreSection: this.shoppingList.byStoreSection.map((section) => ({
        ...section,
        items: updateItems(section.items),
      })),
    };

    return this.shoppingList;
  }

  async saveUserProgressDay(progressDay: UserProgressDay): Promise<UserProgressDay> {
    this.progressDays.set(`${progressDay.userId}:${progressDay.date}`, progressDay);
    return progressDay;
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

const createAuthHeaders = (
  additionalHeaders: Record<string, string> = {},
): Record<string, string> => ({
  Authorization: `Bearer ${sessionTokenService.issueSession(sampleUser, {
    email: "carlos@example.com",
    provider: "password",
  }).token}`,
  ...additionalHeaders,
});

const createTestServer = () => {
  const repositoryUser = new RepositoryUserMock(
    sampleUser,
    sampleDietPlan,
    sampleWorkoutPlan,
  );
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
  callback: (baseUrl: string) => Promise<void>,
): Promise<void> => {
  const app = createTestServer();
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
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
  await withRunningServer(async (baseUrl) => {
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

test("PUT /progress/users/:id/meals/:mealSlot with completed=false removes tracked meal energy", async () => {
  await withRunningServer(async (baseUrl) => {
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
          date: "2026-03-03",
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
          date: "2026-03-03",
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
  });
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
          date: "2026-03-04",
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
          date: "2026-03-04",
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
