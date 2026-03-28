import {
  FormEvent,
  ReactNode,
  useRef,
  startTransition,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import {
  Activity,
  ArrowRight,
  BarChartSquare02,
  CheckCircle,
  Package,
  RefreshCcw02,
  Settings02,
  Shield01,
  ShoppingBag02,
  Target04,
  Zap,
} from "@untitledui/icons";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { gsap } from "gsap";
import { api, ApiError } from "./api";
import {
  dietTypeOptions,
  energyUnitOptions,
  mealConfig,
  profileOptions,
  storageKey,
  viewLabels,
} from "./constants";
import {
  formatNumber,
  getCurrentWeek,
  getFuturePlanWeekForDate,
  getPlanWeekForDate,
  getWeekStartKey,
  humanDate,
  todayKey,
} from "./date";
import type {
  AuthAccount,
  AuthSession,
  CompletePlanResult,
  DietPlan,
  DietPlanDay,
  DietPlanDayMealState,
  DietPlanEntry,
  DietType,
  EnergyUnit,
  MacroSnapshot,
  MealSlot,
  PlanWeek,
  ProfileDraft,
  ProgressDay,
  ProgressSummary,
  ShoppingItem,
  ShoppingList,
  StoredSession,
  UserExerciseLog,
  UserExerciseLogInput,
  UserProfile,
  UserTrackingEntry,
  UserWaterEntry,
  ViewKey,
  WeekDay,
  WorkoutPlan,
  WorkoutPlanDay,
} from "./types";

const mealsPerDayMin = 1;
const mealsPerDayMax = 6;
const kilojoulesPerCalorie = 4.184;
const planWeeks: PlanWeek[] = ["current", "next"];
const dietModes: DietType[] = ["single-food", "recipes"];
const generationStoragePrefix = "ai-shape-generation";
const rollingPlanBufferStoragePrefix = "ai-shape-rolling-buffer";
const generationStatusTtlMs = 1000 * 60 * 30;

type SectionGenerationKind = "diet" | "workout";
type SectionGenerationSource = "redo-plan" | "diet-mode" | "redo-workout" | "auto-workout";
type EnergyHistoryRange = "week" | "month" | "quarter" | "half-year";
type DietPlanBuffers = Record<PlanWeek, Record<DietType, DietPlan | null>>;
type WorkoutPlanBuffers = Record<PlanWeek, WorkoutPlan | null>;

interface SectionGenerationStatus {
  source: SectionGenerationSource;
  title: string;
  message: string;
  startedAt: string;
  dietType?: DietType;
}

interface ExerciseLogDraft {
  date: string;
  exerciseName: string;
  setsCompleted: number;
  repsCompleted: number;
  weightUsed: number;
  volume: number;
}

const emptyDraft: ProfileDraft = {
  name: "",
  age: "",
  gender: "female",
  weight: "",
  targetWeight: "",
  height: "",
  goal: "fat-loss",
  diet: "balanced",
  kindOfDiet: "single-food",
  cheatWeeklyMeal: "no",
  avoidedFoods: "",
  allergies: "",
  levelActivity: "moderate",
  trainLocation: "gym",
  timeToTrain: "",
  injuries: "",
  favoriteFoods: "",
  supplementation: "",
  numberOfMeals: "4",
  energyUnitPreference: "kj",
  favorieteCoucineRecipes: "",
};

const clampMealsPerDay = (value: number): number => {
  if (!Number.isFinite(value)) {
    return mealsPerDayMin;
  }

  return Math.max(mealsPerDayMin, Math.min(mealsPerDayMax, Math.round(value)));
};

const energyHistoryRangeOptions: Array<{
  value: EnergyHistoryRange;
  label: string;
  days: number;
}> = [
  { value: "week", label: "1W", days: 7 },
  { value: "month", label: "1M", days: 30 },
  { value: "quarter", label: "3M", days: 90 },
  { value: "half-year", label: "6M", days: 180 },
];

const forecastLookbackMaxDays = 28;

const toCalories = (kilojoules: number): number => Math.round(kilojoules / kilojoulesPerCalorie);

const getEnergyUnitLabel = (energyUnit: EnergyUnit): string => (
  energyUnit === "cal" ? "kcal" : "kJ"
);

const formatEnergyValue = (kilojoules: number, energyUnit: EnergyUnit): string => (
  `${formatNumber(energyUnit === "cal" ? toCalories(kilojoules) : kilojoules)} ${getEnergyUnitLabel(energyUnit)}`
);

const isEmptyDietEntry = (entry: DietPlanEntry): boolean => (
  entry.object.trim().length === 0
  && entry.description.trim().length === 0
  && entry.quantity === 0
  && entry.quantityUnit.trim().length === 0
  && entry.ingredients.length === 0
  && entry.calories === 0
  && entry.kilojoules === 0
  && entry.macros.protein === "0g"
  && entry.macros.carbs === "0g"
  && entry.macros.fats === "0g"
);

const getRenderableMealConfig = (day: DietPlanDay): typeof mealConfig => (
  mealConfig.filter((meal) => {
    if (meal.slot === "supplements") {
      return day.supplements.length > 0;
    }

    return !isEmptyDietEntry(day[meal.slot] as DietPlanEntry);
  })
);

const splitList = (value: string): string[] => value
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const shiftDateKey = (date: string, offsetDays: number): string => {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + offsetDays);

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const buildDateKeySeries = (endDate: string, length: number): string[] => (
  Array.from({ length }, (_, index) => shiftDateKey(endDate, index - (length - 1)))
);

const formatHistoryAxisLabel = (date: string, range: EnergyHistoryRange): string => {
  const value = new Date(`${date}T00:00:00`);

  if (range === "week") {
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(value);
  }

  if (range === "month") {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(value);
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(value);
};

const buildForecastOffsets = (range: EnergyHistoryRange): number[] => {
  switch (range) {
    case "week":
      return [0, 1, 2, 3, 4, 5, 6, 7];
    case "month":
      return [0, 7, 14, 21, 30];
    case "quarter":
      return [0, 30, 60, 90];
    case "half-year":
      return [0, 30, 60, 90, 120, 150, 180];
    default:
      return [0, 30];
  }
};

const projectWeightTowardTarget = (
  currentWeight: number,
  targetWeight: number,
  averageDailyDeltaKjs: number,
  daysAhead: number,
): number => {
  const projectedWeight = currentWeight + ((averageDailyDeltaKjs * daysAhead) / (7700 * kilojoulesPerCalorie));
  const movingTowardTarget = (targetWeight - currentWeight) * (projectedWeight - currentWeight) > 0;

  if (!movingTowardTarget) {
    return Math.round(projectedWeight * 10) / 10;
  }

  if (currentWeight > targetWeight) {
    return Math.round(Math.max(targetWeight, projectedWeight) * 10) / 10;
  }

  if (currentWeight < targetWeight) {
    return Math.round(Math.min(targetWeight, projectedWeight) * 10) / 10;
  }

  return Math.round(projectedWeight * 10) / 10;
};

const describeTargetGap = (projectedWeight: number, targetWeight: number): string => {
  const gap = Math.round(Math.abs(projectedWeight - targetWeight) * 10) / 10;

  if (gap < 0.1) {
    return "At target";
  }

  return projectedWeight > targetWeight
    ? `${gap.toFixed(1)} kg above target`
    : `${gap.toFixed(1)} kg below target`;
};

const entryKilojoules = (entry: DietPlanEntry): number => (
  Number.isFinite(entry.kilojoules)
    ? Math.round(entry.kilojoules)
    : Math.round((entry.calories ?? 0) * kilojoulesPerCalorie)
);

const parseMacroValue = (value: string | undefined): number => {
  if (typeof value !== "string") {
    return 0;
  }

  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Math.round(Number(match[0])) : 0;
};

const createEmptyMacroSnapshot = (): MacroSnapshot => ({
  proteinGrams: 0,
  carbsGrams: 0,
  fatsGrams: 0,
});

const resolveDietDayTargets = (day: DietPlanDay | null): {
  kjsTarget: number;
  macrosTarget: MacroSnapshot;
} => {
  if (!day) {
    return {
      kjsTarget: 0,
      macrosTarget: createEmptyMacroSnapshot(),
    };
  }

  const entries = [
    day.breakfast,
    day.snack1,
    day.lunch,
    day.dinner,
    day.snack2,
    ...day.supplements,
  ];

  return entries.reduce((current, entry) => ({
    kjsTarget: current.kjsTarget + entryKilojoules(entry),
    macrosTarget: {
      proteinGrams: current.macrosTarget.proteinGrams + parseMacroValue(entry.macros.protein),
      carbsGrams: current.macrosTarget.carbsGrams + parseMacroValue(entry.macros.carbs),
      fatsGrams: current.macrosTarget.fatsGrams + parseMacroValue(entry.macros.fats),
    },
  }), {
    kjsTarget: 0,
    macrosTarget: createEmptyMacroSnapshot(),
  });
};

const parsePlannedCount = (value: string | undefined): number => {
  if (typeof value !== "string") {
    return 0;
  }

  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
};

const calculateExerciseVolume = (
  setsCompleted: number,
  repsCompleted: number,
  weightUsed: number,
): number => Math.round(setsCompleted * repsCompleted * weightUsed * 100) / 100;

const buildExerciseLogDrafts = (day: WorkoutPlanDay, date: string): ExerciseLogDraft[] => (
  day.exercises.map((exercise) => ({
    date,
    exerciseName: exercise.name,
    setsCompleted: parsePlannedCount(exercise.sets),
    repsCompleted: parsePlannedCount(exercise.reps),
    weightUsed: 0,
    volume: 0,
  }))
);

const mergeExerciseLogDrafts = (
  day: WorkoutPlanDay,
  date: string,
  logs: ExerciseLogDraft[] | undefined,
): ExerciseLogDraft[] => {
  const existingByExercise = new Map((logs ?? []).map((log) => [log.exerciseName, log]));

  return buildExerciseLogDrafts(day, date).map((draft) => {
    const existing = existingByExercise.get(draft.exerciseName);

    return existing ?? draft;
  });
};

const groupExerciseLogsByDate = (logs: UserExerciseLog[]): Record<string, ExerciseLogDraft[]> => (
  logs.reduce<Record<string, ExerciseLogDraft[]>>((accumulator, log) => {
    const nextLog: ExerciseLogDraft = {
      date: log.date,
      exerciseName: log.exerciseName,
      setsCompleted: log.setsCompleted,
      repsCompleted: log.repsCompleted,
      weightUsed: log.weightUsed,
      volume: log.volume,
    };

    accumulator[log.date] = [...(accumulator[log.date] ?? []), nextLog];
    return accumulator;
  }, {})
);

const mapExerciseDraftsToInputs = (logs: ExerciseLogDraft[]): UserExerciseLogInput[] => (
  logs.map((log) => ({
    exerciseName: log.exerciseName,
    setsCompleted: log.setsCompleted,
    repsCompleted: log.repsCompleted,
    weightUsed: log.weightUsed,
  }))
);

const mapTrackingEntriesByDate = (entries: UserTrackingEntry[]): Record<string, UserTrackingEntry> => (
  entries.reduce<Record<string, UserTrackingEntry>>((accumulator, entry) => {
    accumulator[entry.date] = entry;
    return accumulator;
  }, {})
);

const mapWaterEntriesByDate = (entries: UserWaterEntry[]): Record<string, UserWaterEntry> => (
  entries.reduce<Record<string, UserWaterEntry>>((accumulator, entry) => {
    accumulator[entry.date] = entry;
    return accumulator;
  }, {})
);

const buildGenerationStorageKey = (
  userId: string,
  kind: SectionGenerationKind,
): string => `${generationStoragePrefix}:${kind}:${userId}`;

const isSectionGenerationStatus = (value: unknown): value is SectionGenerationStatus => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.source === "string"
    && typeof candidate.title === "string"
    && typeof candidate.message === "string"
    && typeof candidate.startedAt === "string"
    && (candidate.dietType === undefined || candidate.dietType === "single-food" || candidate.dietType === "recipes")
  );
};

const readStoredGenerationStatus = (
  userId: string,
  kind: SectionGenerationKind,
): SectionGenerationStatus | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(buildGenerationStorageKey(userId, kind));
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isSectionGenerationStatus(parsed)) {
      window.localStorage.removeItem(buildGenerationStorageKey(userId, kind));
      return null;
    }

    const startedAtTime = new Date(parsed.startedAt).getTime();
    if (Number.isNaN(startedAtTime) || (Date.now() - startedAtTime) > generationStatusTtlMs) {
      window.localStorage.removeItem(buildGenerationStorageKey(userId, kind));
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(buildGenerationStorageKey(userId, kind));
    return null;
  }
};

const persistGenerationStatus = (
  userId: string,
  kind: SectionGenerationKind,
  status: SectionGenerationStatus | null,
): void => {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = buildGenerationStorageKey(userId, kind);

  if (!status) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(status));
};

const shouldRefreshRollingPlanBuffer = (
  userId: string,
  week: PlanWeek,
  referenceDate = new Date(),
): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(buildRollingPlanBufferStorageKey(userId, week)) !== getWeekStartKey(referenceDate);
};

const markRollingPlanBufferRefreshed = (
  userId: string,
  week: PlanWeek,
  referenceDate = new Date(),
): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(buildRollingPlanBufferStorageKey(userId, week), getWeekStartKey(referenceDate));
};

const isProfileReady = (user: UserProfile): boolean => (
  user.name.trim().length > 0
  && user.age > 0
  && user.weight > 0
  && user.targetWeight > 0
  && user.height > 0
  && user.goal.trim().length > 0
  && user.diet.trim().length > 0
  && user.kindOfDiet.trim().length > 0
  && user.levelActivity.trim().length > 0
  && user.trainLocation.trim().length > 0
  && user.timeToTrain > 0
  && user.numberOfMeals > 0
);

const toDraft = (user: UserProfile | null): ProfileDraft => {
  if (!user) {
    return emptyDraft;
  }

  return {
    name: user.name,
    age: String(user.age || ""),
    gender: user.gender || "female",
    weight: String(user.weight || ""),
    targetWeight: String(user.targetWeight || ""),
    height: String(user.height || ""),
    goal: user.goal || "fat-loss",
    diet: user.diet || "balanced",
    kindOfDiet: (user.kindOfDiet === "recipes" ? "recipes" : "single-food"),
    cheatWeeklyMeal: user.cheatWeeklyMeal ? "yes" : "no",
    avoidedFoods: user.avoidedFoods.join(", "),
    allergies: user.allergies.join(", "),
    levelActivity: user.levelActivity || "moderate",
    trainLocation: user.trainLocation || "gym",
    timeToTrain: String(user.timeToTrain || ""),
    injuries: user.injuries.join(", "),
    favoriteFoods: user.favoriteFoods.join(", "),
    supplementation: user.supplementation.join(", "),
    numberOfMeals: String(user.numberOfMeals || 4),
    energyUnitPreference: user.energyUnitPreference === "cal" ? "cal" : "kj",
    favorieteCoucineRecipes: user.favorieteCoucineRecipes.join(", "),
  };
};

const buildSavePayload = (draft: ProfileDraft) => ({
  name: draft.name.trim(),
  age: Number(draft.age),
  gender: draft.gender,
  weight: Number(draft.weight),
  targetWeight: Number(draft.targetWeight),
  height: Number(draft.height),
  goal: draft.goal,
  diet: draft.diet,
  kindOfDiet: draft.kindOfDiet,
  cheatWeeklyMeal: draft.cheatWeeklyMeal === "yes",
  avoidedFoods: splitList(draft.avoidedFoods),
  allergies: splitList(draft.allergies),
  levelActivity: draft.levelActivity,
  trainLocation: draft.trainLocation,
  timeToTrain: Number(draft.timeToTrain),
  injuries: splitList(draft.injuries),
  favoriteFoods: splitList(draft.favoriteFoods),
  supplementation: splitList(draft.supplementation),
  numberOfMeals: clampMealsPerDay(Number(draft.numberOfMeals)),
  energyUnitPreference: draft.energyUnitPreference,
  favorieteCoucineRecipes: splitList(draft.favorieteCoucineRecipes),
});

const titleCase = (value: string): string => value.replace(/-/g, " ");

const progressPercent = (value: number, target: number): number => {
  if (target <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (value / target) * 100));
};

const firstOrEmpty = (list: string[]): string => list[0] ?? "No notes yet";

const resolveCurrentDietType = (user: UserProfile | null): DietType => (
  user?.kindOfDiet === "recipes" ? "recipes" : "single-food"
);

const createEmptyDietPlans = (): DietPlanBuffers => ({
  current: {
    "single-food": null,
    recipes: null,
  },
  next: {
    "single-food": null,
    recipes: null,
  },
});

const createEmptyDietMealState = (): DietPlanDayMealState => ({
  breakfast: false,
  snack1: false,
  lunch: false,
  dinner: false,
  snack2: false,
  supplements: false,
});

const withDietMealStateDefaults = (plan: DietPlan): DietPlan => ({
  ...plan,
  days: plan.days.map((day) => ({
    ...day,
    eatenMeals: {
      ...createEmptyDietMealState(),
      ...day.eatenMeals,
    },
  })),
});

const withWorkoutCompletionStateDefaults = (plan: WorkoutPlan): WorkoutPlan => ({
  ...plan,
  days: plan.days.map((day) => ({
    ...day,
    completed: day.completed ?? false,
  })),
});

const createEmptyWorkoutPlans = (): WorkoutPlanBuffers => ({
  current: null,
  next: null,
});

const patchDietPlansMealState = (
  dietPlans: DietPlanBuffers,
  week: PlanWeek,
  dietType: DietType,
  dayNumber: number,
  mealSlot: MealSlot,
  completed: boolean,
): DietPlanBuffers => {
  const plan = dietPlans[week][dietType];

  if (!plan) {
    return dietPlans;
  }

  return {
    ...dietPlans,
    [week]: {
      ...dietPlans[week],
      [dietType]: {
        ...plan,
        days: plan.days.map((day) => (
          day.day === dayNumber
            ? {
              ...day,
              eatenMeals: {
                ...createEmptyDietMealState(),
                ...day.eatenMeals,
                [mealSlot]: completed,
              },
            }
            : day
        )),
      },
    },
  };
};

const patchWorkoutPlanCompletionState = (
  workoutPlans: WorkoutPlanBuffers,
  week: PlanWeek,
  dayNumber: number,
  completed: boolean,
): WorkoutPlanBuffers => {
  const workoutPlan = workoutPlans[week];

  if (!workoutPlan) {
    return workoutPlans;
  }

  return {
    ...workoutPlans,
    [week]: {
      ...workoutPlan,
      days: workoutPlan.days.map((day) => (
        day.day === dayNumber
          ? {
            ...day,
            completed,
          }
          : day
      )),
    },
  };
};

const createEmptyShoppingLists = (): Record<PlanWeek, Record<DietType, ShoppingList | null>> => ({
  current: {
    "single-food": null,
    recipes: null,
  },
  next: {
    "single-food": null,
    recipes: null,
  },
});

const buildRollingPlanBufferStorageKey = (userId: string, week: PlanWeek): string => (
  `${rollingPlanBufferStoragePrefix}:${userId}:${week}`
);

const parseStoredSession = (value: string | null): StoredSession | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as StoredSession;

    if (
      typeof parsed.token !== "string"
      || typeof parsed.expiresAt !== "string"
      || typeof parsed.userId !== "string"
      || typeof parsed.account?.email !== "string"
      || (parsed.account?.provider !== "password" && parsed.account?.provider !== "google")
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const isSessionExpired = (expiresAt: string): boolean => (
  Number.isNaN(new Date(expiresAt).getTime()) || new Date(expiresAt).getTime() <= Date.now()
);

const googleIdentityScriptUrl = "https://accounts.google.com/gsi/client";
let googleScriptPromise: Promise<void> | null = null;

const loadGoogleIdentityScript = (): Promise<void> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser"));
  }

  if (window.google?.accounts.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${googleIdentityScriptUrl}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => {
        googleScriptPromise = null;
        reject(new Error("Unable to load Google sign-in"));
      }, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = googleIdentityScriptUrl;
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = () => resolve();
    script.onerror = () => {
      googleScriptPromise = null;
      reject(new Error("Unable to load Google sign-in"));
    };
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

const viewIcons: Record<ViewKey, typeof BarChartSquare02> = {
  dashboard: BarChartSquare02,
  diet: Target04,
  workout: Activity,
  shopping: ShoppingBag02,
  settings: Settings02,
};

const heroHighlights = [
  {
    icon: Shield01,
    title: "Session-based access",
    body: "Email/password or Google sign-in, with expiring sessions instead of raw user IDs.",
  },
  {
    icon: Target04,
    title: "Flexible diet mode",
    body: "Switch between single foods and recipes without leaving the workspace.",
  },
  {
    icon: ShoppingBag02,
    title: "Weekly market list",
    body: "See grams for foods, milliliters for liquids, AU store estimates, and persistent check-offs.",
  },
] as const;

function App() {
  const defaultSelectedDay = getCurrentWeek().find((day) => day.date === todayKey())?.dayNumber ?? 1;
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [authAccount, setAuthAccount] = useState<AuthAccount | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [dietPlans, setDietPlans] = useState<DietPlanBuffers>(createEmptyDietPlans);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlanBuffers>(createEmptyWorkoutPlans);
  const [shoppingLists, setShoppingLists] = useState<Record<PlanWeek, Record<DietType, ShoppingList | null>>>(createEmptyShoppingLists);
  const [todayProgress, setTodayProgress] = useState<ProgressDay | null>(null);
  const [monthSummary, setMonthSummary] = useState<ProgressSummary | null>(null);
  const [yearSummary, setYearSummary] = useState<ProgressSummary | null>(null);
  const [weekProgress, setWeekProgress] = useState<Record<string, ProgressDay>>({});
  const [weekTracking, setWeekTracking] = useState<Record<string, UserTrackingEntry>>({});
  const [weekWater, setWeekWater] = useState<Record<string, UserWaterEntry>>({});
  const [exerciseLogsByDate, setExerciseLogsByDate] = useState<Record<string, ExerciseLogDraft[]>>({});
  const [selectedDietDay, setSelectedDietDay] = useState(defaultSelectedDay);
  const [selectedDietType, setSelectedDietType] = useState<DietType>("single-food");
  const [selectedDietWeek, setSelectedDietWeek] = useState<PlanWeek>("current");
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState(defaultSelectedDay);
  const [selectedWorkoutWeek, setSelectedWorkoutWeek] = useState<PlanWeek>("current");
  const [selectedShoppingDietType, setSelectedShoppingDietType] = useState<DietType>("single-food");
  const [selectedShoppingWeek, setSelectedShoppingWeek] = useState<PlanWeek>("current");
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(emptyDraft);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("Checking your session...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [dietGenerationStatus, setDietGenerationStatus] = useState<SectionGenerationStatus | null>(null);
  const [workoutGenerationStatus, setWorkoutGenerationStatus] = useState<SectionGenerationStatus | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pendingMealKey, setPendingMealKey] = useState<string | null>(null);
  const [pendingWaterDate, setPendingWaterDate] = useState<string | null>(null);
  const [pendingWorkoutDay, setPendingWorkoutDay] = useState<number | null>(null);
  const [pendingShoppingItemId, setPendingShoppingItemId] = useState<string | null>(null);
  const [recipePreview, setRecipePreview] = useState<{
    title: string;
    description: string;
    instructions: string[];
    preparationTimeMinutes?: number;
  } | null>(null);
  const mealActionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const authLayoutRef = useRef<HTMLDivElement | null>(null);
  const autoRollingBufferAttemptRef = useRef<string | null>(null);
  const activeSessionUserIdRef = useRef<string | null>(null);

  const weekDays = getCurrentWeek();
  const nextWeekReferenceDate = new Date();
  nextWeekReferenceDate.setDate(nextWeekReferenceDate.getDate() + 7);
  const nextWeekDays = getCurrentWeek(nextWeekReferenceDate);
  const trackedDietWeekDays = [...weekDays, ...nextWeekDays];
  const today = todayKey();
  const weekRangeStart = weekDays[0]?.date ?? today;
  const weekRangeEnd = nextWeekDays[nextWeekDays.length - 1]?.date ?? weekDays[weekDays.length - 1]?.date ?? today;
  const trackingHistoryStart = shiftDateKey(today, -179);
  const trackingHistoryEnd = today;
  const exerciseHistoryStart = shiftDateKey(today, -27);
  const profileComplete = user ? isProfileReady(user) : false;
  const activeDietType = resolveCurrentDietType(user);
  const activePlanWeek = getPlanWeekForDate();
  const futurePlanWeek = getFuturePlanWeekForDate();
  const visibleDietStorageWeek = selectedDietWeek;
  const visibleDietWeekDays = selectedDietWeek === "current" ? weekDays : nextWeekDays;
  const visibleWorkoutStorageWeek = selectedWorkoutWeek;
  const visibleWorkoutWeekDays = selectedWorkoutWeek === "current" ? weekDays : nextWeekDays;
  const visibleShoppingLists = shoppingLists;
  const activeCurrentShoppingList = shoppingLists[activePlanWeek][activeDietType];
  const isRefreshingWorkout = workoutGenerationStatus !== null;
  const isRegeneratingPlan = dietGenerationStatus?.source === "redo-plan"
    || workoutGenerationStatus?.source === "redo-plan";

  useEffect(() => {
    activeSessionUserIdRef.current = sessionUserId;
  }, [sessionUserId]);

  useEffect(() => {
    const storedSession = parseStoredSession(window.localStorage.getItem(storageKey));

    if (!storedSession) {
      setHydrated(true);
      setStatusMessage("Create a member or sign in.");
      return;
    }

    if (isSessionExpired(storedSession.expiresAt)) {
      clearSession("Your session expired. Sign in again.");
      return;
    }

    api.setAccessToken(storedSession.token);
    setAuthAccount(storedSession.account);
    setSessionExpiresAt(storedSession.expiresAt);

    void restoreSession(storedSession);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unauthorizedEvent = api.getUnauthorizedEventName();
    const handleUnauthorized = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      clearSession(detail?.message ?? "Your session expired. Sign in again.");
    };

    window.addEventListener(unauthorizedEvent, handleUnauthorized as EventListener);

    return () => {
      window.removeEventListener(unauthorizedEvent, handleUnauthorized as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!sessionUserId) {
      setDietGenerationStatus(null);
      setWorkoutGenerationStatus(null);
      return;
    }

    setDietGenerationStatus(readStoredGenerationStatus(sessionUserId, "diet"));
    setWorkoutGenerationStatus(readStoredGenerationStatus(sessionUserId, "workout"));
  }, [sessionUserId]);

  useEffect(() => {
    if (!sessionUserId || !user || !isProfileReady(user)) {
      return;
    }

    if (!shouldRefreshRollingPlanBuffer(sessionUserId, futurePlanWeek)) {
      return;
    }

    const refreshAttemptKey = `${sessionUserId}:${getWeekStartKey()}:${futurePlanWeek}`;
    if (autoRollingBufferAttemptRef.current === refreshAttemptKey) {
      return;
    }

    autoRollingBufferAttemptRef.current = refreshAttemptKey;
    void regenerateFuturePlanBuffer(futurePlanWeek);
  }, [futurePlanWeek, sessionUserId, user]);

  useLayoutEffect(() => {
    if (!authLayoutRef.current || (sessionUserId && user)) {
      return undefined;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const context = gsap.context(() => {
      const introTimeline = gsap.timeline({
        defaults: {
          ease: "power3.out",
        },
      });

      introTimeline
        .from("[data-hero-brand]", { y: 28, opacity: 0, duration: 0.8 })
        .from("[data-hero-headline]", { y: 40, opacity: 0, duration: 0.9 }, "-=0.45")
        .from("[data-hero-copy]", { y: 24, opacity: 0, duration: 0.72 }, "-=0.5")
        .from("[data-hero-google]", { y: 24, opacity: 0, scale: 0.98, duration: 0.68 }, "-=0.4")
        .from("[data-hero-card]", { y: 28, opacity: 0, duration: 0.65, stagger: 0.12 }, "-=0.28")
        .from("[data-auth-card]", { x: 28, opacity: 0, duration: 0.72, stagger: 0.14 }, "-=0.7");

      gsap.to("[data-logo-badge]", {
        y: -10,
        rotate: -4,
        duration: 2.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.to("[data-hero-card]", {
        y: -6,
        duration: 2.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.18,
        delay: 1,
      });
    }, authLayoutRef);

    return () => {
      context.revert();
    };
  }, [sessionUserId, user]);

  async function restoreSession(storedSession: StoredSession) {
    setBusyAction("workspace");
    setErrorMessage(null);
    setStatusMessage("Re-opening your studio...");

    try {
      const session = await api.getSession();
      const nextSession: StoredSession = {
        token: storedSession.token,
        expiresAt: session.expiresAt,
        userId: session.user.id,
        account: session.account,
      };

      persistSession(nextSession);
      await loadWorkspace(session.user.id, "Re-opening your studio...", session.account, session.expiresAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to restore session";
      clearSession(message);
    } finally {
      setBusyAction(null);
    }
  }

  function persistSession(session: StoredSession) {
    window.localStorage.setItem(storageKey, JSON.stringify(session));
    api.setAccessToken(session.token);
    setSessionUserId(session.userId);
    setAuthAccount(session.account);
    setSessionExpiresAt(session.expiresAt);
  }

  function isCurrentSession(userId: string) {
    return activeSessionUserIdRef.current === userId;
  }

  function syncDietGenerationStatus(userId: string, status: SectionGenerationStatus | null) {
    persistGenerationStatus(userId, "diet", status);

    if (isCurrentSession(userId)) {
      setDietGenerationStatus(status);
    }
  }

  function syncWorkoutGenerationStatus(userId: string, status: SectionGenerationStatus | null) {
    persistGenerationStatus(userId, "workout", status);

    if (isCurrentSession(userId)) {
      setWorkoutGenerationStatus(status);
    }
  }

  function clearSession(message?: string) {
    window.localStorage.removeItem(storageKey);
    api.clearAccessToken();
    setSessionUserId(null);
    setAuthAccount(null);
    setSessionExpiresAt(null);
    setUser(null);
    setDietPlans(createEmptyDietPlans());
    setWorkoutPlans(createEmptyWorkoutPlans());
    setShoppingLists(createEmptyShoppingLists());
    setTodayProgress(null);
    setMonthSummary(null);
    setYearSummary(null);
    setWeekProgress({});
    setWeekTracking({});
    setWeekWater({});
    setExerciseLogsByDate({});
    setSelectedDietDay(defaultSelectedDay);
    setSelectedDietType("single-food");
    setSelectedDietWeek("current");
    setSelectedWorkoutDay(defaultSelectedDay);
    setSelectedWorkoutWeek("current");
    setSelectedShoppingDietType("single-food");
    setSelectedShoppingWeek("current");
    setProfileDraft(emptyDraft);
    setActiveView("dashboard");
    setRecipePreview(null);
    setPendingMealKey(null);
    setPendingWaterDate(null);
    setPendingWorkoutDay(null);
    setPendingShoppingItemId(null);
    setDietGenerationStatus(null);
    setWorkoutGenerationStatus(null);
    autoRollingBufferAttemptRef.current = null;
    setHydrated(true);
    setBusyAction(null);
    setStatusMessage("Create a member or sign in.");
    setErrorMessage(message ?? null);
  }

  async function loadWorkspace(
    userId: string,
    message = "Loading your studio...",
    nextAccount: AuthAccount | null = authAccount,
    nextExpiresAt: string | null = sessionExpiresAt,
  ) {
    setBusyAction("workspace");
    setErrorMessage(null);
    setStatusMessage(message);

    try {
      const freshUser = await api.getUser(userId);
      const [
        singleFoodDietCurrent,
        singleFoodDietNext,
        recipeDietCurrent,
        recipeDietNext,
        freshWorkoutCurrent,
        freshWorkoutNext,
        singleFoodShoppingCurrent,
        recipeShoppingCurrent,
        singleFoodShoppingNext,
        recipeShoppingNext,
        freshToday,
        freshMonth,
        freshYear,
        trackingEntries,
        waterEntries,
        exerciseLogs,
      ] = await Promise.all([
        api.getDietPlan(userId, { dietType: "single-food", week: "current" }),
        api.getDietPlan(userId, { dietType: "single-food", week: "next" }),
        api.getDietPlan(userId, { dietType: "recipes", week: "current" }),
        api.getDietPlan(userId, { dietType: "recipes", week: "next" }),
        api.getWorkoutPlan(userId, { week: "current" }),
        api.getWorkoutPlan(userId, { week: "next" }),
        api.getShoppingList(userId, { dietType: "single-food", week: "current" }),
        api.getShoppingList(userId, { dietType: "recipes", week: "current" }),
        api.getShoppingList(userId, { dietType: "single-food", week: "next" }),
        api.getShoppingList(userId, { dietType: "recipes", week: "next" }),
        api.getProgressDay(userId, today),
        api.getProgressSummary(userId, "month", today),
        api.getProgressSummary(userId, "year", today),
        api.getTrackingEntries(userId, trackingHistoryStart, trackingHistoryEnd),
        api.getWaterEntries(userId, weekRangeStart, weekRangeEnd),
        api.getExerciseLogs(userId, exerciseHistoryStart, today),
      ]);
      const activeDietType = resolveCurrentDietType(freshUser);

      const progressDays = await Promise.all(
        trackedDietWeekDays.map(async (weekDay) => {
          const progressDay = await api.getProgressDay(userId, weekDay.date);
          return [weekDay.date, progressDay] as const;
        }),
      );
      const nextWeekProgress = Object.fromEntries(progressDays);

      startTransition(() => {
        setSessionUserId(userId);
        setAuthAccount(nextAccount);
        setSessionExpiresAt(nextExpiresAt);
        setUser(freshUser);
        setProfileDraft(toDraft(freshUser));
        setDietPlans({
          current: {
            "single-food": singleFoodDietCurrent ? withDietMealStateDefaults(singleFoodDietCurrent) : null,
            recipes: recipeDietCurrent ? withDietMealStateDefaults(recipeDietCurrent) : null,
          },
          next: {
            "single-food": singleFoodDietNext ? withDietMealStateDefaults(singleFoodDietNext) : null,
            recipes: recipeDietNext ? withDietMealStateDefaults(recipeDietNext) : null,
          },
        });
        setWorkoutPlans({
          current: freshWorkoutCurrent ? withWorkoutCompletionStateDefaults(freshWorkoutCurrent) : null,
          next: freshWorkoutNext ? withWorkoutCompletionStateDefaults(freshWorkoutNext) : null,
        });
        setShoppingLists({
          current: {
            "single-food": singleFoodShoppingCurrent,
            recipes: recipeShoppingCurrent,
          },
          next: {
            "single-food": singleFoodShoppingNext,
            recipes: recipeShoppingNext,
          },
        });
        setTodayProgress(freshToday);
        setMonthSummary(freshMonth);
        setYearSummary(freshYear);
        setWeekProgress(nextWeekProgress);
        setWeekTracking(mapTrackingEntriesByDate(trackingEntries));
        setWeekWater(mapWaterEntriesByDate(waterEntries));
        setExerciseLogsByDate(groupExerciseLogsByDate(exerciseLogs));
        setSelectedDietType(activeDietType);
        setSelectedShoppingDietType(activeDietType);
        setSelectedShoppingWeek("current");
        setActiveView(isProfileReady(freshUser) ? "dashboard" : "settings");
        setHydrated(true);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reach the backend";

      if (error instanceof ApiError && error.status === 401) {
        clearSession(message);
        return;
      }

      setErrorMessage(message);
      setHydrated(true);
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshProgress(userId: string) {
    const [freshToday, freshMonth, freshYear, progressDays, trackingEntries, waterEntries, exerciseLogs] = await Promise.all([
      api.getProgressDay(userId, today),
      api.getProgressSummary(userId, "month", today),
      api.getProgressSummary(userId, "year", today),
      Promise.all(
        trackedDietWeekDays.map(async (weekDay) => [weekDay.date, await api.getProgressDay(userId, weekDay.date)] as const),
      ),
      api.getTrackingEntries(userId, trackingHistoryStart, trackingHistoryEnd),
      api.getWaterEntries(userId, weekRangeStart, weekRangeEnd),
      api.getExerciseLogs(userId, exerciseHistoryStart, today),
    ]);

    const nextWeekProgress = Object.fromEntries(progressDays);

    startTransition(() => {
      setTodayProgress(freshToday);
      setMonthSummary(freshMonth);
      setYearSummary(freshYear);
      setWeekProgress(nextWeekProgress);
      setWeekTracking(mapTrackingEntriesByDate(trackingEntries));
      setWeekWater(mapWaterEntriesByDate(waterEntries));
      setExerciseLogsByDate(groupExerciseLogsByDate(exerciseLogs));
    });
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    setBusyAction("create");
    setErrorMessage(null);

    try {
      const response = await api.register(createEmail.trim(), createPassword);
      setCreateEmail("");
      setCreatePassword("");
      persistSession({
        token: response.token,
        expiresAt: response.expiresAt,
        userId: response.user.id,
        account: response.account,
      });
      await loadWorkspace(
        response.user.id,
        "Studio created. Pulling your profile...",
        response.account,
        response.expiresAt,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create account");
      setBusyAction(null);
    }
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusyAction("login");
    setErrorMessage(null);

    try {
      const response = await api.login(loginEmail.trim(), loginPassword);
      setLoginEmail("");
      setLoginPassword("");
      persistSession({
        token: response.token,
        expiresAt: response.expiresAt,
        userId: response.user.id,
        account: response.account,
      });
      await loadWorkspace(
        response.user.id,
        "Opening your studio...",
        response.account,
        response.expiresAt,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in");
      setBusyAction(null);
    }
  }

  async function continueWithGoogle(idToken: string) {
    setBusyAction("google");
    setErrorMessage(null);

    try {
      const response = await api.googleAuth(idToken);
      persistSession({
        token: response.token,
        expiresAt: response.expiresAt,
        userId: response.user.id,
        account: response.account,
      });
      await loadWorkspace(
        response.user.id,
        "Opening your Google session...",
        response.account,
        response.expiresAt,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to continue with Google");
      setBusyAction(null);
    }
  }

  async function saveProfile(options?: {
    regenerate?: boolean;
    dietType?: DietType;
    week?: PlanWeek;
  }) {
    if (!sessionUserId) {
      return;
    }

    const requestUserId = sessionUserId;
    setBusyAction("save");
    setErrorMessage(null);

    try {
      await api.saveUser(requestUserId, buildSavePayload({
        ...profileDraft,
        kindOfDiet: options?.dietType ?? profileDraft.kindOfDiet,
      }));

      const refreshedUser = await api.getUser(requestUserId);
      const resolvedDietType = options?.dietType ?? resolveCurrentDietType(refreshedUser);

      if (isCurrentSession(requestUserId)) {
        setUser(refreshedUser);
        setProfileDraft(toDraft(refreshedUser));
      }

      if (options?.regenerate) {
        const week = options.week ?? activePlanWeek;
        syncDietGenerationStatus(requestUserId, {
          source: "redo-plan",
          title: `Updating ${resolvedDietType === "recipes" ? "recipe" : "single-food"} diet`,
          message: `Saving the refreshed ${resolvedDietType === "recipes" ? "recipe" : "single-food"} week in the background.`,
          startedAt: new Date().toISOString(),
          dietType: resolvedDietType,
        });
        syncWorkoutGenerationStatus(requestUserId, {
          source: "redo-plan",
          title: "Updating workout plan",
          message: "Rebuilding your workout block in the background.",
          startedAt: new Date().toISOString(),
        });

        if (isCurrentSession(requestUserId)) {
          setBusyAction(null);
        }

        try {
          const generated = await api.generateCompletePlan(
            requestUserId,
            resolvedDietType,
            week,
          );

          if (isCurrentSession(requestUserId)) {
            hydrateGeneratedPlans(generated, resolvedDietType, week);
          }
        } finally {
          syncDietGenerationStatus(requestUserId, null);
          syncWorkoutGenerationStatus(requestUserId, null);
        }
      }
    } catch (error) {
      if (isCurrentSession(requestUserId)) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to save your profile");
      }
    } finally {
      if (isCurrentSession(requestUserId)) {
        setBusyAction(null);
      }
    }
  }

  function hydrateGeneratedPlans(
    result: CompletePlanResult,
    dietType: DietType,
    week: PlanWeek = "current",
  ) {
    if (result.dietPlan) {
      const hydratedDietPlan = withDietMealStateDefaults(result.dietPlan);
      setDietPlans((current) => ({
        ...current,
        [week]: {
          ...current[week],
          [dietType]: hydratedDietPlan,
        },
      }));
    }

    if (result.workoutPlan) {
      setWorkoutPlans((current) => ({
        ...current,
        [week]: withWorkoutCompletionStateDefaults(result.workoutPlan!),
      }));
    }

    if (result.shoppingList) {
      setShoppingLists((current) => ({
        ...current,
        [week]: {
          ...current[week],
          [dietType]: result.shoppingList,
        },
      }));
    }
  }

  async function regenerateWeek(dietType: DietType, week: PlanWeek = activePlanWeek) {
    if (!sessionUserId) {
      return;
    }

    const requestUserId = sessionUserId;
    setErrorMessage(null);
    syncDietGenerationStatus(requestUserId, {
      source: "redo-plan",
      title: `Updating ${dietType === "recipes" ? "recipe" : "single-food"} diet`,
      message: `Refreshing the saved ${dietType === "recipes" ? "recipe" : "single-food"} week in the background.`,
      startedAt: new Date().toISOString(),
      dietType,
    });
    syncWorkoutGenerationStatus(requestUserId, {
      source: "redo-plan",
      title: "Updating workout plan",
      message: "Refreshing the linked workout block in the background.",
      startedAt: new Date().toISOString(),
    });

    try {
      const result = await api.generateCompletePlan(requestUserId, dietType, week);

      if (isCurrentSession(requestUserId)) {
        hydrateGeneratedPlans(result, dietType, week);
      }
    } catch (error) {
      if (isCurrentSession(requestUserId)) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to rebuild plan");
      }
    } finally {
      syncDietGenerationStatus(requestUserId, null);
      syncWorkoutGenerationStatus(requestUserId, null);
    }
  }

  async function regenerateFuturePlanBuffer(week: PlanWeek) {
    if (!sessionUserId) {
      return;
    }

    const requestUserId = sessionUserId;

    try {
      for (const dietType of dietModes) {
        const result = await api.generateCompletePlan(requestUserId, dietType, week);

        if (isCurrentSession(requestUserId)) {
          hydrateGeneratedPlans(result, dietType, week);
        }
      }

      markRollingPlanBufferRefreshed(requestUserId, week);
    } catch (error) {
      if (isCurrentSession(requestUserId)) {
        autoRollingBufferAttemptRef.current = null;
        setErrorMessage(error instanceof Error ? error.message : "Unable to refresh the future plan buffer");
      }
    }
  }

  async function generateMissingDietMode(dietType: DietType, week: PlanWeek = activePlanWeek) {
    if (!sessionUserId) {
      return;
    }

    const requestUserId = sessionUserId;
    setErrorMessage(null);
    syncDietGenerationStatus(requestUserId, {
      source: "diet-mode",
      title: `Creating ${dietType === "recipes" ? "recipe" : "single-food"} table`,
      message: `Generating the missing ${dietType === "recipes" ? "recipe" : "single-food"} diet table in the background.`,
      startedAt: new Date().toISOString(),
      dietType,
    });

    try {
      const generatedDietPlan = await api.generateDietPlan(requestUserId, dietType, {
        week,
        activateDietType: false,
      });

      if (isCurrentSession(requestUserId)) {
        setDietPlans((current) => ({
          ...current,
          [week]: {
            ...current[week],
            [dietType]: withDietMealStateDefaults(generatedDietPlan),
          },
        }));
        setSelectedDietType(dietType);
      }
    } catch (error) {
      if (isCurrentSession(requestUserId)) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to generate this diet mode");
      }
    } finally {
      syncDietGenerationStatus(requestUserId, null);
    }
  }

  async function regenerateWorkoutPlan(options?: { automatic?: boolean; week?: PlanWeek }) {
    if (!sessionUserId || isRefreshingWorkout) {
      return;
    }

    const requestUserId = sessionUserId;
    const automatic = options?.automatic ?? false;
    const week = options?.week ?? activePlanWeek;
    syncWorkoutGenerationStatus(requestUserId, {
      source: automatic ? "auto-workout" : "redo-workout",
      title: automatic ? "Refreshing future workout" : "Updating workout plan",
      message: automatic
        ? "The future workout block is updating in the background."
        : "Rebuilding your workout block in the background.",
      startedAt: new Date().toISOString(),
    });

    if (!automatic) {
      setErrorMessage(null);
    }

    try {
      const generatedWorkoutPlan = await api.generateWorkoutPlan(requestUserId, {
        week,
      });

      if (isCurrentSession(requestUserId)) {
        setWorkoutPlans((current) => ({
          ...current,
          [week]: withWorkoutCompletionStateDefaults(generatedWorkoutPlan),
        }));
      }
    } catch (error) {
      if (isCurrentSession(requestUserId)) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to rebuild workout plan");
      }
    } finally {
      syncWorkoutGenerationStatus(requestUserId, null);
    }
  }

  async function toggleMeal(
    day: DietPlanDay,
    mealSlot: MealSlot,
    completed: boolean,
    dietType: DietType,
    mappedDate: string,
    week: PlanWeek,
  ) {
    if (!sessionUserId) {
      return;
    }

    const mealKey = `${mappedDate}:${mealSlot}`;
    const previousDietPlans = dietPlans;
    setDietPlans((current) => patchDietPlansMealState(current, week, dietType, day.day, mealSlot, completed));
    setPendingMealKey(mealKey);

    mealActionQueueRef.current = mealActionQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const result = await api.toggleMeal(sessionUserId, mealSlot, mappedDate, completed, {
          dietType,
          week,
        });
        setWeekProgress((current) => ({ ...current, [mappedDate]: result }));

        if (mappedDate === today) {
          setTodayProgress(result);
        }

        await refreshProgress(sessionUserId);
      })
      .catch((error) => {
        setDietPlans(previousDietPlans);
        setErrorMessage(error instanceof Error ? error.message : "Unable to update meal progress");
      })
      .finally(() => {
        setPendingMealKey((current) => (current === mealKey ? null : current));
      });

    await mealActionQueueRef.current;
  }

  function updateExerciseLogs(date: string, logs: ExerciseLogDraft[]) {
    setExerciseLogsByDate((current) => ({
      ...current,
      [date]: logs,
    }));
  }

  async function toggleWorkout(day: WorkoutPlanDay, completed: boolean, mappedDate: string, week: PlanWeek) {
    if (!sessionUserId) {
      return;
    }

    const exerciseLogs = mergeExerciseLogDrafts(day, mappedDate, exerciseLogsByDate[mappedDate]);
    const previousWorkoutPlans = workoutPlans;
    setWorkoutPlans((current) => patchWorkoutPlanCompletionState(current, week, day.day, completed));
    setPendingWorkoutDay(day.day);

    try {
      const result = await api.toggleWorkout(
        sessionUserId,
        mappedDate,
        completed,
        completed ? mapExerciseDraftsToInputs(exerciseLogs) : [],
        {
          week,
        },
      );
      setWeekProgress((current) => ({ ...current, [mappedDate]: result }));

      if (mappedDate === today) {
        setTodayProgress(result);
      }

      await refreshProgress(sessionUserId);
    } catch (error) {
      setWorkoutPlans(previousWorkoutPlans);
      setErrorMessage(error instanceof Error ? error.message : "Unable to update workout progress");
    } finally {
      setPendingWorkoutDay(null);
    }
  }

  async function saveWater(date: string, glassesCompleted: number) {
    if (!sessionUserId) {
      return;
    }

    const previousEntry = weekWater[date];

    if (!previousEntry) {
      return;
    }

    setWeekWater((current) => ({
      ...current,
      [date]: {
        ...previousEntry,
        glassesCompleted,
        completedLiters: Math.round(glassesCompleted * previousEntry.litersPerGlass * 10) / 10,
      },
    }));
    setPendingWaterDate(date);

    try {
      const result = await api.saveWater(sessionUserId, date, glassesCompleted);
      setWeekWater((current) => ({
        ...current,
        [date]: result,
      }));
    } catch (error) {
      setWeekWater((current) => ({
        ...current,
        [date]: previousEntry,
      }));
      setErrorMessage(error instanceof Error ? error.message : "Unable to update water progress");
    } finally {
      setPendingWaterDate((current) => (current === date ? null : current));
    }
  }

  async function toggleShoppingItem(item: ShoppingItem, checked: boolean) {
    if (!sessionUserId || !item.id) {
      return;
    }

    setPendingShoppingItemId(item.id);

    try {
      const result = await api.toggleShoppingItem(
        sessionUserId,
        item.id,
        checked,
        {
          dietType: selectedShoppingDietType,
          week: selectedShoppingWeek,
        },
      );
      setShoppingLists((current) => ({
        ...current,
        [selectedShoppingWeek]: {
          ...current[selectedShoppingWeek],
          [selectedShoppingDietType]: result,
        },
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update the market list");
    } finally {
      setPendingShoppingItemId(null);
    }
  }

  function logout() {
    clearSession();
  }

  if (!hydrated || busyAction === "workspace") {
    return (
      <div className="loading-screen">
        <div className="loading-orb">
          <img src="/ai-shape-logo.svg" alt="" aria-hidden="true" />
        </div>
        <p>{statusMessage}</p>
      </div>
    );
  }

  if (!sessionUserId || !user) {
    return (
      <div className="auth-layout" ref={authLayoutRef}>
        <section className="auth-hero">
          <div className="hero-brand" data-hero-brand>
            <div className="hero-logo-shell" data-logo-badge>
              <img src="/ai-shape-logo.svg" alt="AI Shape logo" className="hero-logo" />
            </div>
            <div className="hero-brand-copy">
              <div className="eyebrow">AI Shape Studio</div>
              <span>Nutrition, training, and recovery planning in one adaptive board.</span>
            </div>
          </div>
          <h1 data-hero-headline>Build a week that feels coached, not generic.</h1>
          <p data-hero-copy>
            Start with your body data, your food style, and the time you actually have.
            The app maps your diet, training, market list, and daily progress in one place.
          </p>
          <div className="hero-google-entry" data-hero-google>
            <div className="hero-google-copy">
              <strong>Continue with Google</strong>
              <span>Tap the round Google entry to sign up or sign in with the same account chooser.</span>
            </div>
            <GoogleAuthButton
              variant="icon"
              busy={busyAction === "google"}
              onCredential={continueWithGoogle}
              showBusyText
            />
          </div>
          <div className="hero-grid">
            {heroHighlights.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.title} data-hero-card>
                  <span className="feature-icon">
                    <Icon />
                  </span>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-card" data-auth-card>
            <h2>Create your member</h2>
            <form onSubmit={createAccount} className="stack">
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(event) => setCreateEmail(event.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(event) => setCreatePassword(event.target.value)}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                />
              </label>
              <button className="primary-button" type="submit" disabled={busyAction === "create"}>
                {busyAction === "create" ? "Creating studio..." : "Create member"}
              </button>
              <GoogleAuthButton
                variant="signup"
                busy={busyAction === "google"}
                onCredential={continueWithGoogle}
              />
            </form>
          </div>

          <div className="auth-card subtle" data-auth-card>
            <h2>Sign back in</h2>
            <form onSubmit={signIn} className="stack">
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  required
                  minLength={6}
                  placeholder="Your password"
                />
              </label>
              <button className="secondary-button" type="submit" disabled={busyAction === "login"}>
                {busyAction === "login" ? "Signing in..." : "Sign in"}
              </button>
              <GoogleAuthButton
                variant="signin"
                busy={busyAction === "google"}
                onCredential={continueWithGoogle}
              />
            </form>
          </div>

          {errorMessage ? <div className="inline-error">{errorMessage}</div> : null}
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-top">
            <div className="sidebar-brand-mark">
              <img src="/ai-shape-logo.svg" alt="AI Shape logo" />
            </div>
            <div className="sidebar-brand-copy">
              <span className="eyebrow">AI Shape</span>
              <h1>{user.name || "New member"}</h1>
            </div>
          </div>
          <p>{user.goal ? titleCase(user.goal) : "Finish your assessment to unlock your week."}</p>
        </div>

        <nav className="sidebar-nav">
          {(Object.keys(viewLabels) as ViewKey[]).map((view) => {
            const Icon = viewIcons[view];

            return (
              <button
                key={view}
                type="button"
                className={activeView === view ? "nav-pill active" : "nav-pill"}
                onClick={() => startTransition(() => setActiveView(view))}
              >
                <Icon className="nav-icon" />
                <span>{viewLabels[view]}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div>
            <strong>{authAccount?.provider === "google" ? "Google session" : "Signed in"}</strong>
            <span>{authAccount?.email ?? user.id}</span>
          </div>
          <div>
            <strong>Session expires</strong>
            <span>{sessionExpiresAt ? new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date(sessionExpiresAt)) : "Unknown"}</span>
          </div>
          <button type="button" className="ghost-button" onClick={logout}>
            Sign out
          </button>
        </div>
        </aside>

        <main className="workspace">
        {errorMessage ? <div className="inline-error workspace-error">{errorMessage}</div> : null}

        {!profileComplete ? (
          <ProfileEditor
            draft={profileDraft}
            onChange={setProfileDraft}
            onSave={() => saveProfile()}
            onSaveAndGenerate={() => saveProfile({ regenerate: true })}
            busyAction={busyAction}
            isRegeneratingPlan={isRegeneratingPlan}
          />
        ) : (
          <>
            {activeView === "dashboard" ? (
              <DashboardView
                user={user}
                todayProgress={todayProgress}
                weekDays={weekDays}
                weekProgress={weekProgress}
                weekTracking={weekTracking}
                exerciseLogsByDate={exerciseLogsByDate}
                dietPlan={dietPlans[activePlanWeek][activeDietType]}
                workoutPlan={workoutPlans[activePlanWeek]}
                shoppingList={activeCurrentShoppingList}
                onGenerate={() => regenerateWeek(activeDietType)}
                isRegeneratingPlan={isRegeneratingPlan}
                energyUnitPreference={user.energyUnitPreference}
              />
            ) : null}

            {activeView === "diet" ? (
              <DietView
                plans={dietPlans[visibleDietStorageWeek]}
                selectedDay={selectedDietDay}
                onSelectDay={setSelectedDietDay}
                selectedDietType={selectedDietType}
                onSelectDietType={setSelectedDietType}
                selectedWeek={selectedDietWeek}
                onSelectWeek={setSelectedDietWeek}
                onToggleMeal={(day, mealSlot, completed, dietType, mappedDate) => (
                  toggleMeal(day, mealSlot, completed, dietType, mappedDate, visibleDietStorageWeek)
                )}
                onOpenRecipe={(entry) => setRecipePreview({
                  title: entry.object,
                  description: entry.description,
                  instructions: entry.instructions ?? [],
                  preparationTimeMinutes: entry.preparationTimeMinutes,
                })}
                weekDays={visibleDietWeekDays}
                weekProgress={weekProgress}
                weekWater={weekWater}
                pendingMealKey={pendingMealKey}
                pendingWaterDate={pendingWaterDate}
                energyUnitPreference={user.energyUnitPreference}
                mealTargetCount={user.numberOfMeals}
                hasConfiguredSupplements={user.supplementation.length > 0}
                onGenerateMissingDietType={(dietType) => generateMissingDietMode(dietType, visibleDietStorageWeek)}
                generationStatus={dietGenerationStatus}
                onSaveWater={saveWater}
                onRegenerateDietMode={(dietType, week) => regenerateWeek(dietType, week)}
              />
            ) : null}

            {activeView === "workout" ? (
              <WorkoutView
                plan={workoutPlans[visibleWorkoutStorageWeek]}
                selectedDay={selectedWorkoutDay}
                onSelectDay={setSelectedWorkoutDay}
                selectedWeek={selectedWorkoutWeek}
                onSelectWeek={setSelectedWorkoutWeek}
                onToggleWorkout={(day, completed, mappedDate) => (
                  toggleWorkout(day, completed, mappedDate, visibleWorkoutStorageWeek)
                )}
                exerciseLogsByDate={exerciseLogsByDate}
                onUpdateExerciseLogs={updateExerciseLogs}
                onRegenerateWorkout={() => regenerateWorkoutPlan({ week: visibleWorkoutStorageWeek })}
                weekDays={visibleWorkoutWeekDays}
                weekProgress={weekProgress}
                pendingWorkoutDay={pendingWorkoutDay}
                energyUnitPreference={user.energyUnitPreference}
                generationStatus={workoutGenerationStatus}
              />
            ) : null}

            {activeView === "shopping" ? (
              <ShoppingView
                shoppingLists={visibleShoppingLists}
                selectedDietType={selectedShoppingDietType}
                onSelectDietType={setSelectedShoppingDietType}
                selectedWeek={selectedShoppingWeek}
                onSelectWeek={setSelectedShoppingWeek}
                onToggleItem={toggleShoppingItem}
                pendingItemId={pendingShoppingItemId}
              />
            ) : null}

            {activeView === "settings" ? (
              <ProfileEditor
                draft={profileDraft}
                onChange={setProfileDraft}
                onSave={() => saveProfile()}
                onSaveAndGenerate={() => saveProfile({ regenerate: true })}
                busyAction={busyAction}
                isRegeneratingPlan={isRegeneratingPlan}
                compact
              />
            ) : null}
          </>
        )}
        </main>

      <RecipeModal
        recipePreview={recipePreview}
        onClose={() => setRecipePreview(null)}
      />
    </div>
    </>
  );
}

function SectionGenerationCard(props: {
  kind: SectionGenerationKind;
  status: SectionGenerationStatus;
}) {
  return (
    <div className="panel-status-card" role="status" aria-live="polite" aria-busy="true">
      <div className="panel-status-media" aria-hidden="true">
        <DotLottieReact
          src={props.kind === "diet" ? "/diet-generation.lottie" : "/workout-generation.lottie"}
          loop
          autoplay
          renderConfig={{ autoResize: true }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div className="panel-status-copy">
        <span className="eyebrow">{props.kind === "diet" ? "Diet Loading" : "Workout Loading"}</span>
        <strong>{props.status.title}</strong>
        <p>{props.status.message}</p>
      </div>
    </div>
  );
}

function DashboardView(props: {
  user: UserProfile;
  todayProgress: ProgressDay | null;
  weekDays: WeekDay[];
  weekProgress: Record<string, ProgressDay>;
  weekTracking: Record<string, UserTrackingEntry>;
  exerciseLogsByDate: Record<string, ExerciseLogDraft[]>;
  dietPlan: DietPlan | null;
  workoutPlan: WorkoutPlan | null;
  shoppingList: ShoppingList | null;
  onGenerate: () => void;
  isRegeneratingPlan: boolean;
  energyUnitPreference: EnergyUnit;
}) {
  const {
    user,
    weekDays,
    weekProgress,
    weekTracking,
    exerciseLogsByDate,
    dietPlan,
    energyUnitPreference,
  } = props;

  return (
    <div className="view-grid">
      <section className="panel span-full">
        <div className="week-pulse-grid">
          {weekDays.map((weekDay) => {
            const progress = weekProgress[weekDay.date];
            const tracking = weekTracking[weekDay.date];
            const dietDay = dietPlan?.days.find((day) => day.day === weekDay.dayNumber) ?? null;
            const targets = resolveDietDayTargets(dietDay);
            const target = tracking?.kjsTarget ?? targets.kjsTarget;
            const consumed = tracking?.kjsConsumed ?? 0;
            const withinTargetWindow = target > 0
              && consumed >= target * 0.8
              && consumed <= target * 1.2;
            const pulsePassed = withinTargetWindow && (progress?.workout.completed ?? false);

            return (
              <article key={weekDay.date} className="week-pulse-card">
                <strong>{weekDay.shortLabel.toLowerCase()}</strong>
                <span className={pulsePassed ? "week-pulse-mark pass" : "week-pulse-mark fail"}>
                  {pulsePassed ? "✓" : "×"}
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel span-full">
        <DailyEnergyChart
          user={user}
          weekDays={weekDays}
          weekTracking={weekTracking}
          dietPlan={dietPlan}
          energyUnitPreference={energyUnitPreference}
        />
      </section>

      <section className="panel span-full">
        <MacroBreakdownChart
          weekDays={weekDays}
          weekTracking={weekTracking}
          dietPlan={dietPlan}
        />
      </section>

      <section className="panel span-full">
        <StrengthPerformancePanel
          exerciseLogsByDate={exerciseLogsByDate}
        />
      </section>
    </div>
  );
}

function DailyEnergyChart(props: {
  user: UserProfile;
  weekDays: WeekDay[];
  weekTracking: Record<string, UserTrackingEntry>;
  dietPlan: DietPlan | null;
  energyUnitPreference: EnergyUnit;
}) {
  const [selectedRange, setSelectedRange] = useState<EnergyHistoryRange>("week");
  const forecastStartDate = todayKey();
  const chartWidth = 720;
  const chartHeight = 280;
  const paddingX = 42;
  const paddingTop = 24;
  const paddingBottom = 44;
  const usableHeight = chartHeight - paddingTop - paddingBottom;
  const usableWidth = chartWidth - (paddingX * 2);
  const energyUnitLabel = props.energyUnitPreference === "cal" ? "kcal" : "kJ";
  const rangeConfig = energyHistoryRangeOptions.find((option) => option.value === selectedRange)
    ?? energyHistoryRangeOptions[0];
  const lookbackDays = Math.min(rangeConfig.days, forecastLookbackMaxDays);
  const lookbackDates = buildDateKeySeries(forecastStartDate, lookbackDays);
  const currentWeekDaysByDate = new Map(props.weekDays.map((weekDay) => [weekDay.date, weekDay]));
  const observedDays = lookbackDates.map((date) => {
    const tracking = props.weekTracking[date];
    const weekDay = currentWeekDaysByDate.get(date);
    const dietDay = weekDay
      ? props.dietPlan?.days.find((day) => day.day === weekDay.dayNumber) ?? null
      : null;
    const plannedTargetKjs = resolveDietDayTargets(dietDay).kjsTarget;
    const targetKjs = tracking?.kjsTarget
      ?? (plannedTargetKjs > 0 ? plannedTargetKjs : props.user.kilojoulesTarget);
    const consumedKjs = tracking?.kjsConsumed;

    return {
      date,
      consumedKjs,
      targetKjs,
    };
  });
  const trackedObservedDays = observedDays.filter((day) => typeof day.consumedKjs === "number");
  const trendSource = trackedObservedDays.length > 0 ? trackedObservedDays : observedDays;
  const averageConsumedKjs = trendSource.reduce((sum, day) => sum + (day.consumedKjs ?? day.targetKjs), 0) / Math.max(trendSource.length, 1);
  const averageTargetKjs = trendSource.reduce((sum, day) => sum + day.targetKjs, 0) / Math.max(trendSource.length, 1);
  const averageDailyDeltaKjs = averageConsumedKjs - averageTargetKjs;
  const forecastOffsets = buildForecastOffsets(selectedRange);
  const series = forecastOffsets.map((daysAhead) => {
    const date = shiftDateKey(forecastStartDate, daysAhead);

    return {
      date,
      label: formatHistoryAxisLabel(date, selectedRange),
      consumedKjs: averageConsumedKjs,
      targetKjs: averageTargetKjs,
      projectedWeight: projectWeightTowardTarget(
        props.user.weight,
        props.user.targetWeight,
        averageDailyDeltaKjs,
        daysAhead,
      ),
    };
  });
  const chartSeries = series.map((day) => ({
    ...day,
    consumed: props.energyUnitPreference === "cal"
      ? toCalories(day.consumedKjs)
      : day.consumedKjs,
    target: props.energyUnitPreference === "cal"
      ? toCalories(day.targetKjs)
      : day.targetKjs,
  }));
  const projectedWeights = series.map((day) => day.projectedWeight);
  const maxEnergy = Math.max(1, ...chartSeries.flatMap((day) => [day.consumed, day.target]));
  const weightMin = Math.min(props.user.weight, ...projectedWeights);
  const weightMax = Math.max(props.user.weight, ...projectedWeights);
  const weightRange = Math.max(weightMax - weightMin, 0.6);
  const labelStep = Math.max(1, Math.ceil(chartSeries.length / 6));
  const showDots = chartSeries.length <= 31;

  const resolveEnergyY = (value: number): number => (
    paddingTop + ((maxEnergy - value) / maxEnergy) * usableHeight
  );

  const resolveWeightY = (value: number): number => (
    paddingTop + ((weightMax + 0.3 - value) / (weightRange + 0.6)) * usableHeight
  );

  const consumedPoints = chartSeries.map((day, index) => {
    const x = paddingX + ((usableWidth / Math.max(chartSeries.length - 1, 1)) * index);
    return `${x},${resolveEnergyY(day.consumed)}`;
  }).join(" ");
  const targetPoints = chartSeries.map((day, index) => {
    const x = paddingX + ((usableWidth / Math.max(chartSeries.length - 1, 1)) * index);
    return `${x},${resolveEnergyY(day.target)}`;
  }).join(" ");
  const projectedWeightPoints = projectedWeights.map((value, index) => {
    const x = paddingX + ((usableWidth / Math.max(projectedWeights.length - 1, 1)) * index);
    return `${x},${resolveWeightY(value)}`;
  }).join(" ");
  const forecastWeightCards = [
    { title: "1 month", days: 30 },
    { title: "3 months", days: 90 },
    { title: "6 months", days: 180 },
  ].map((item) => {
    const projectedWeight = projectWeightTowardTarget(
      props.user.weight,
      props.user.targetWeight,
      averageDailyDeltaKjs,
      item.days,
    );

    return {
      ...item,
      projectedWeight,
      detail: describeTargetGap(projectedWeight, props.user.targetWeight),
    };
  });

  return (
    <>
      <div className="panel-header">
        <div>
          <span className="eyebrow">Daily adherence</span>
          <h3>{props.energyUnitPreference === "cal" ? "Calories vs target" : "Kilojoules vs target"}</h3>
          <p className="muted-line">
            Future forecast from the last {trackedObservedDays.length > 0 ? trackedObservedDays.length : lookbackDays} tracked days. It projects body weight toward {props.user.targetWeight} kg if this intake trend continues.
          </p>
        </div>
        <div className="panel-header-aside chart-range-toggle" role="group" aria-label="Energy chart range">
          {energyHistoryRangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`toggle ${selectedRange === option.value ? "active" : ""}`}
              onClick={() => setSelectedRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-legend">
        <span className="chart-legend-item energy-consumed">Projected intake</span>
        <span className="chart-legend-item energy-target">Target</span>
        <span className="chart-legend-item" style={{ ["--legend-color" as string]: "#b55d32" }}>Projected weight</span>
      </div>

      <div className="body-chart-shell">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="body-chart"
          role="img"
          aria-label={`${props.energyUnitPreference === "cal" ? "Calories" : "Kilojoules"} forecast versus target and projected weight`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingTop + (usableHeight * ratio);
            const energyStep = props.energyUnitPreference === "cal" ? 50 : 200;
            const energyValue = Math.round((maxEnergy - (maxEnergy * ratio)) / energyStep) * energyStep;
            const weightValue = weightMax + 0.3 - ((weightRange + 0.6) * ratio);

            return (
              <g key={ratio}>
                <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} className="body-chart-grid" />
                <text x={8} y={y + 4} className="body-chart-axis">{`${formatNumber(Math.max(energyValue, 0))} ${energyUnitLabel}`}</text>
                <text x={chartWidth - 34} y={y + 4} textAnchor="end" className="body-chart-axis">
                  {weightValue.toFixed(1)} kg
                </text>
              </g>
            );
          })}

          <polyline
            points={targetPoints}
            className="body-chart-line"
            style={{ stroke: "#2f7f6d", strokeDasharray: "10 8" }}
          />
          <polyline
            points={consumedPoints}
            className="body-chart-line"
            style={{ stroke: "#ef7f45" }}
          />
          <polyline
            points={projectedWeightPoints}
            className="body-chart-line"
            style={{ stroke: "#b55d32" }}
          />

          {chartSeries.map((day, index) => {
            const x = paddingX + ((usableWidth / Math.max(chartSeries.length - 1, 1)) * index);
            const shouldShowLabel = index === 0
              || index === chartSeries.length - 1
              || index % labelStep === 0;

            return (
              <g key={day.date}>
                {showDots ? <circle cx={x} cy={resolveEnergyY(day.consumed)} r={4.5} style={{ fill: "#ef7f45" }} /> : null}
                {showDots ? <circle cx={x} cy={resolveWeightY(projectedWeights[index])} r={4.5} style={{ fill: "#b55d32" }} /> : null}
                {shouldShowLabel ? (
                  <text x={x} y={chartHeight - 12} textAnchor="middle" className="body-chart-axis">
                    {day.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="stats-grid composition-stats">
        {forecastWeightCards.map((card) => (
          <MetricCard
            key={card.title}
            title={card.title}
            value={`${card.projectedWeight.toFixed(1)} kg`}
            detail={card.detail}
          />
        ))}
      </div>
    </>
  );
}

function MacroBreakdownChart(props: {
  weekDays: WeekDay[];
  weekTracking: Record<string, UserTrackingEntry>;
  dietPlan: DietPlan | null;
}) {
  const daysWithMacros = props.weekDays.map((weekDay) => {
    const tracking = props.weekTracking[weekDay.date];
    const dietDay = props.dietPlan?.days.find((day) => day.day === weekDay.dayNumber) ?? null;
    const targets = resolveDietDayTargets(dietDay).macrosTarget;
    return {
      consumed: tracking?.macrosConsumed ?? createEmptyMacroSnapshot(),
      target: tracking?.macrosTarget ?? targets,
    };
  });
  const divisor = Math.max(daysWithMacros.length, 1);
  const averageProtein = Math.round(daysWithMacros.reduce((sum, item) => sum + item.consumed.proteinGrams, 0) / divisor);
  const averageCarbs = Math.round(daysWithMacros.reduce((sum, item) => sum + item.consumed.carbsGrams, 0) / divisor);
  const averageFats = Math.round(daysWithMacros.reduce((sum, item) => sum + item.consumed.fatsGrams, 0) / divisor);
  const averageProteinTarget = Math.round(daysWithMacros.reduce((sum, item) => sum + item.target.proteinGrams, 0) / divisor);
  const averageCarbsTarget = Math.round(daysWithMacros.reduce((sum, item) => sum + item.target.carbsGrams, 0) / divisor);
  const averageFatsTarget = Math.round(daysWithMacros.reduce((sum, item) => sum + item.target.fatsGrams, 0) / divisor);

  return (
    <>
      <div className="panel-header">
        <div>
          <span className="eyebrow">Macro balance</span>
          <h3>Average macros</h3>
          <p className="muted-line">Current week averages against the planned macro targets.</p>
        </div>
      </div>

      <div className="stats-grid composition-stats">
        <MetricCard
          title="Avg Protein"
          value={`${averageProtein}g`}
          detail={`${averageProteinTarget}g target`}
        />
        <MetricCard
          title="Avg Carbs"
          value={`${averageCarbs}g`}
          detail={`${averageCarbsTarget}g target`}
        />
        <MetricCard
          title="Avg Fat"
          value={`${averageFats}g`}
          detail={`${averageFatsTarget}g target`}
        />
      </div>
    </>
  );
}

type StrengthViewMode = "progress" | "compare" | "volume";

interface StrengthHistoryPoint {
  date: string;
  oneRepMax: number;
  volume: number;
  setsCompleted: number;
  repsCompleted: number;
  weightUsed: number;
}

interface StrengthSeries {
  exerciseName: string;
  color: string;
  points: StrengthHistoryPoint[];
}

interface WeeklyStrengthVolumeBucket {
  label: string;
  volumes: Array<{
    exerciseName: string;
    color: string;
    volume: number;
  }>;
  totalVolume: number;
}

const strengthPalette = ["#4a8ed9", "#2ba983", "#d0871e", "#db5b8c", "#8676dc"];

const formatStrengthValue = (value: number): string => (
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)
);

const dateKeyFromValue = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const resolveWeekBucketKey = (date: string): string => {
  const value = new Date(`${date}T12:00:00`);
  const weekday = value.getDay() === 0 ? 7 : value.getDay();
  value.setDate(value.getDate() - weekday + 1);

  return dateKeyFromValue(value);
};

const estimateOneRepMax = (weightUsed: number, repsCompleted: number): number => (
  Math.round(weightUsed * (1 + (repsCompleted / 30)) * 10) / 10
);

const buildStrengthSeries = (
  exerciseLogsByDate: Record<string, ExerciseLogDraft[]>,
) : StrengthSeries[] => {
  const grouped = new Map<string, Map<string, StrengthHistoryPoint>>();

  for (const log of Object.values(exerciseLogsByDate).flat()) {
    if (log.weightUsed <= 0 || log.repsCompleted <= 0 || log.setsCompleted <= 0) {
      continue;
    }

    const pointsByDate = grouped.get(log.exerciseName) ?? new Map<string, StrengthHistoryPoint>();
    const currentPoint = pointsByDate.get(log.date);
    const nextOneRepMax = estimateOneRepMax(log.weightUsed, log.repsCompleted);

    pointsByDate.set(log.date, currentPoint ? {
      ...currentPoint,
      oneRepMax: Math.max(currentPoint.oneRepMax, nextOneRepMax),
      volume: currentPoint.volume + log.volume,
      setsCompleted: currentPoint.setsCompleted + log.setsCompleted,
      repsCompleted: Math.max(currentPoint.repsCompleted, log.repsCompleted),
      weightUsed: Math.max(currentPoint.weightUsed, log.weightUsed),
    } : {
      date: log.date,
      oneRepMax: nextOneRepMax,
      volume: log.volume,
      setsCompleted: log.setsCompleted,
      repsCompleted: log.repsCompleted,
      weightUsed: log.weightUsed,
    });

    grouped.set(log.exerciseName, pointsByDate);
  }

  return Array.from(grouped.entries())
    .map(([exerciseName, pointsByDate]) => ({
      exerciseName,
      color: "#ef7f45",
      points: Array.from(pointsByDate.values()).sort((left, right) => left.date.localeCompare(right.date)),
    }))
    .sort((left, right) => {
      const leftCurrent = left.points[left.points.length - 1]?.oneRepMax ?? 0;
      const rightCurrent = right.points[right.points.length - 1]?.oneRepMax ?? 0;
      return rightCurrent - leftCurrent || left.exerciseName.localeCompare(right.exerciseName);
    })
    .map((series, index) => ({
      ...series,
      color: strengthPalette[index % strengthPalette.length],
    }));
};

const buildWeeklyStrengthVolumeBuckets = (series: StrengthSeries[]): WeeklyStrengthVolumeBucket[] => {
  const weekKeys = Array.from(new Set(
    series.flatMap((item) => item.points.map((point) => resolveWeekBucketKey(point.date))),
  )).sort();

  return weekKeys.map((weekKey, index) => {
    const volumes = series.map((item) => ({
      exerciseName: item.exerciseName,
      color: item.color,
      volume: item.points
        .filter((point) => resolveWeekBucketKey(point.date) === weekKey)
        .reduce((sum, point) => sum + point.volume, 0),
    }));

    return {
      label: `W${index + 1}`,
      volumes,
      totalVolume: volumes.reduce((sum, item) => sum + item.volume, 0),
    };
  });
};

function StrengthPerformancePanel(props: {
  exerciseLogsByDate: Record<string, ExerciseLogDraft[]>;
}) {
  const [strengthView, setStrengthView] = useState<StrengthViewMode>("progress");
  const [selectedExerciseName, setSelectedExerciseName] = useState("");
  const strengthSeries = buildStrengthSeries(props.exerciseLogsByDate);

  if (strengthSeries.length === 0) {
    return (
      <>
        <div className="panel-header">
          <div>
            <span className="eyebrow">Strength profile</span>
            <h3>Strength comparison</h3>
          </div>
        </div>
        <p className="empty-line">
          Finish workouts with weight used to unlock strength comparison, progress, and volume views.
        </p>
      </>
    );
  }

  const selectedSeries = strengthSeries.find((item) => item.exerciseName === selectedExerciseName) ?? strengthSeries[0];
  const progressPoints = selectedSeries.points;
  const compareSeries = strengthSeries.slice(0, 5);
  const currentOneRepMax = progressPoints[progressPoints.length - 1]?.oneRepMax ?? 0;
  const firstOneRepMax = progressPoints[0]?.oneRepMax ?? 0;
  const allTimePrPoint = progressPoints.reduce((best, point) => (
    point.oneRepMax > best.oneRepMax ? point : best
  ), progressPoints[0]);
  const totalGain = currentOneRepMax - firstOneRepMax;
  const totalGainPercent = firstOneRepMax > 0 ? (totalGain / firstOneRepMax) * 100 : 0;

  const renderProgressView = () => {
    const chartWidth = 720;
    const chartHeight = 280;
    const paddingX = 36;
    const paddingTop = 20;
    const paddingBottom = 42;
    const usableWidth = chartWidth - (paddingX * 2);
    const usableHeight = chartHeight - paddingTop - paddingBottom;
    const minValue = Math.min(...progressPoints.map((point) => point.oneRepMax));
    const maxValue = Math.max(...progressPoints.map((point) => point.oneRepMax));
    const valueRange = Math.max(maxValue - minValue, 4);
    const resolveY = (value: number): number => (
      paddingTop + ((maxValue + 2 - value) / (valueRange + 4)) * usableHeight
    );
    const points = progressPoints.map((point, index) => {
      const x = paddingX + ((usableWidth / Math.max(progressPoints.length - 1, 1)) * index);
      return `${x},${resolveY(point.oneRepMax)}`;
    }).join(" ");
    const filledAreaPoints = [
      `${paddingX},${chartHeight - paddingBottom}`,
      points,
      `${paddingX + usableWidth},${chartHeight - paddingBottom}`,
    ].join(" ");

    return (
      <>
        <div className="strength-controls">
          <strong>Estimated 1RM over time</strong>
          <select
            value={selectedSeries.exerciseName}
            onChange={(event) => setSelectedExerciseName(event.target.value)}
          >
            {strengthSeries.map((item) => (
              <option key={item.exerciseName} value={item.exerciseName}>
                {item.exerciseName}
              </option>
            ))}
          </select>
        </div>

        <div className="stats-grid strength-stat-grid">
          <MetricCard
            title="Current 1RM"
            value={`${formatStrengthValue(currentOneRepMax)} kg`}
            detail="Estimated from the latest logged session"
          />
          <MetricCard
            title="All-time PR"
            value={`${formatStrengthValue(allTimePrPoint.oneRepMax)} kg`}
            detail={humanDate(allTimePrPoint.date)}
          />
          <MetricCard
            title="Total gain"
            value={`${totalGain > 0 ? "+" : ""}${formatStrengthValue(totalGain)} kg`}
            detail={`${totalGainPercent > 0 ? "+" : ""}${totalGainPercent.toFixed(1)}% from first session`}
          />
        </div>

        <div className="body-chart-shell">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="body-chart" role="img" aria-label="Estimated 1RM over time">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = paddingTop + (usableHeight * ratio);
              const value = maxValue + 2 - ((valueRange + 4) * ratio);

              return (
                <g key={ratio}>
                  <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} className="body-chart-grid" />
                  <text x={8} y={y + 4} className="body-chart-axis">{formatStrengthValue(value)}</text>
                </g>
              );
            })}

            <polygon points={filledAreaPoints} className="strength-area-fill" />
            <polyline points={points} className="body-chart-line" style={{ stroke: selectedSeries.color }} />
            {progressPoints.map((point, index) => {
              const x = paddingX + ((usableWidth / Math.max(progressPoints.length - 1, 1)) * index);

              return (
                <g key={point.date}>
                  <circle cx={x} cy={resolveY(point.oneRepMax)} r={5} style={{ fill: selectedSeries.color }} />
                  <text x={x} y={chartHeight - 12} textAnchor="middle" className="body-chart-axis">
                    {`S${index + 1}`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="strength-chip-row">
          <span className="strength-chip gain">{`${totalGainPercent > 0 ? "+" : ""}${totalGainPercent.toFixed(1)}% strength gain`}</span>
          <span className="strength-chip pr">{`PR: ${formatStrengthValue(allTimePrPoint.oneRepMax)} kg`}</span>
          <span className="strength-chip">{`${progressPoints.length} sessions logged`}</span>
        </div>
      </>
    );
  };

  const renderCompareView = () => {
    const chartWidth = 720;
    const chartHeight = 280;
    const paddingX = 36;
    const paddingTop = 20;
    const paddingBottom = 42;
    const usableWidth = chartWidth - (paddingX * 2);
    const usableHeight = chartHeight - paddingTop - paddingBottom;
    const allDates = Array.from(new Set(compareSeries.flatMap((item) => item.points.map((point) => point.date)))).sort();
    const minValue = Math.min(...compareSeries.flatMap((item) => item.points.map((point) => point.oneRepMax)));
    const maxValue = Math.max(...compareSeries.flatMap((item) => item.points.map((point) => point.oneRepMax)));
    const valueRange = Math.max(maxValue - minValue, 6);
    const resolveY = (value: number): number => (
      paddingTop + ((maxValue + 3 - value) / (valueRange + 6)) * usableHeight
    );
    const rankingRows = compareSeries
      .map((item) => ({
        exerciseName: item.exerciseName,
        color: item.color,
        current: item.points[item.points.length - 1]?.oneRepMax ?? 0,
        gainPercent: item.points[0]?.oneRepMax
          ? (((item.points[item.points.length - 1]?.oneRepMax ?? 0) - item.points[0].oneRepMax) / item.points[0].oneRepMax) * 100
          : 0,
      }))
      .sort((left, right) => right.current - left.current);
    const maxCurrent = Math.max(...rankingRows.map((item) => item.current), 1);
    const maxGain = Math.max(...rankingRows.map((item) => Math.abs(item.gainPercent)), 1);

    return (
      <>
        <div className="panel-header">
          <div>
            <span className="eyebrow">Compare</span>
            <h3>All lifts, estimated 1RM progression</h3>
          </div>
        </div>

        <div className="chart-legend">
          {compareSeries.map((item) => (
            <span key={item.exerciseName} className="chart-legend-item" style={{ ["--legend-color" as string]: item.color }}>
              {item.exerciseName}
            </span>
          ))}
        </div>

        <div className="body-chart-shell">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="body-chart" role="img" aria-label="All lifts estimated 1RM progression">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = paddingTop + (usableHeight * ratio);
              const value = maxValue + 3 - ((valueRange + 6) * ratio);

              return (
                <g key={ratio}>
                  <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} className="body-chart-grid" />
                  <text x={8} y={y + 4} className="body-chart-axis">{formatStrengthValue(value)}</text>
                </g>
              );
            })}

            {compareSeries.map((item) => (
              <g key={item.exerciseName}>
                <polyline
                  points={item.points.map((point) => {
                    const dateIndex = allDates.indexOf(point.date);
                    const x = paddingX + ((usableWidth / Math.max(allDates.length - 1, 1)) * dateIndex);
                    return `${x},${resolveY(point.oneRepMax)}`;
                  }).join(" ")}
                  className="body-chart-line"
                  style={{ stroke: item.color }}
                />
                {item.points.map((point) => {
                  const dateIndex = allDates.indexOf(point.date);
                  const x = paddingX + ((usableWidth / Math.max(allDates.length - 1, 1)) * dateIndex);

                  return (
                    <circle
                      key={`${item.exerciseName}-${point.date}`}
                      cx={x}
                      cy={resolveY(point.oneRepMax)}
                      r={4.5}
                      style={{ fill: item.color }}
                    />
                  );
                })}
              </g>
            ))}

            {allDates.map((date, index) => {
              const x = paddingX + ((usableWidth / Math.max(allDates.length - 1, 1)) * index);

              return (
                <text key={date} x={x} y={chartHeight - 12} textAnchor="middle" className="body-chart-axis">
                  {`S${index + 1}`}
                </text>
              );
            })}
          </svg>
        </div>

        <div className="strength-detail-grid">
          <article className="subpanel strength-bars">
            <strong>Current 1RM ranking</strong>
            {rankingRows.map((item) => (
              <div key={item.exerciseName} className="strength-bar-row">
                <span>{item.exerciseName}</span>
                <div className="strength-bar-track">
                  <span
                    className="strength-bar-fill"
                    style={{
                      width: `${(item.current / maxCurrent) * 100}%`,
                      background: item.color,
                    }}
                  />
                </div>
                <strong>{`${formatStrengthValue(item.current)} kg`}</strong>
              </div>
            ))}
          </article>

          <article className="subpanel strength-bars">
            <strong>% gain since start</strong>
            {rankingRows.map((item) => (
              <div key={item.exerciseName} className="strength-bar-row">
                <span>{item.exerciseName}</span>
                <div className="strength-bar-track">
                  <span
                    className="strength-bar-fill"
                    style={{
                      width: `${(Math.abs(item.gainPercent) / maxGain) * 100}%`,
                      background: item.color,
                    }}
                  />
                </div>
                <strong>{`${item.gainPercent > 0 ? "+" : ""}${item.gainPercent.toFixed(1)}%`}</strong>
              </div>
            ))}
          </article>
        </div>
      </>
    );
  };

  const renderVolumeView = () => {
    const volumeSeries = compareSeries;
    const weeklyBuckets = buildWeeklyStrengthVolumeBuckets(volumeSeries);
    const chartWidth = 720;
    const chartHeight = 260;
    const paddingX = 40;
    const paddingTop = 18;
    const paddingBottom = 40;
    const usableWidth = chartWidth - (paddingX * 2);
    const usableHeight = chartHeight - paddingTop - paddingBottom;
    const barSlot = usableWidth / Math.max(weeklyBuckets.length, 1);
    const barWidth = barSlot * 0.62;
    const maxVolume = Math.max(...weeklyBuckets.map((item) => item.totalVolume), 1);
    const averageSetsRepsRows = volumeSeries.map((item) => {
      const averageSets = item.points.reduce((sum, point) => sum + point.setsCompleted, 0) / Math.max(item.points.length, 1);
      const averageReps = item.points.reduce((sum, point) => sum + point.repsCompleted, 0) / Math.max(item.points.length, 1);
      return {
        exerciseName: item.exerciseName,
        color: item.color,
        averageSets,
        averageReps,
        averageWork: averageSets * averageReps,
      };
    });
    const maxAverageWork = Math.max(...averageSetsRepsRows.map((item) => item.averageWork), 1);

    return (
      <>
        <div className="panel-header">
          <div>
            <span className="eyebrow">Volume</span>
            <h3>Weekly training volume (kg × reps)</h3>
          </div>
        </div>

        <div className="chart-legend">
          {volumeSeries.map((item) => (
            <span key={item.exerciseName} className="chart-legend-item" style={{ ["--legend-color" as string]: item.color }}>
              {item.exerciseName}
            </span>
          ))}
        </div>

        <div className="body-chart-shell">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="body-chart" role="img" aria-label="Weekly training volume">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = paddingTop + (usableHeight * ratio);
              const value = maxVolume - (maxVolume * ratio);

              return (
                <g key={ratio}>
                  <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} className="body-chart-grid" />
                  <text x={8} y={y + 4} className="body-chart-axis">{formatNumber(value)}</text>
                </g>
              );
            })}

            {weeklyBuckets.map((bucket, index) => {
              const x = paddingX + (barSlot * index) + ((barSlot - barWidth) / 2);
              let runningHeight = 0;

              return (
                <g key={bucket.label}>
                  {bucket.volumes.map((item) => {
                    if (item.volume <= 0) {
                      return null;
                    }

                    const segmentHeight = (item.volume / maxVolume) * usableHeight;
                    const y = paddingTop + usableHeight - runningHeight - segmentHeight;
                    runningHeight += segmentHeight;

                    return (
                      <rect
                        key={`${bucket.label}-${item.exerciseName}`}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={segmentHeight}
                        rx={12}
                        style={{ fill: item.color }}
                      />
                    );
                  })}
                  <text x={x + (barWidth / 2)} y={chartHeight - 12} textAnchor="middle" className="body-chart-axis">
                    {bucket.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="strength-detail-grid">
          <article className="subpanel strength-bars">
            <strong>Avg sets × reps per session</strong>
            {averageSetsRepsRows.map((item) => (
              <div key={item.exerciseName} className="strength-bar-row">
                <span>{item.exerciseName}</span>
                <div className="strength-bar-track">
                  <span
                    className="strength-bar-fill"
                    style={{
                      width: `${(item.averageWork / maxAverageWork) * 100}%`,
                      background: item.color,
                    }}
                  />
                </div>
                <strong>{`${Math.round(item.averageSets)}×${Math.round(item.averageReps)}`}</strong>
              </div>
            ))}
          </article>
        </div>
      </>
    );
  };

  return (
    <>
      <div className="panel-header">
        <div>
          <span className="eyebrow">Strength profile</span>
          <h3>Strength comparison</h3>
          <p className="muted-line">Based on logged weight and reps from completed workouts.</p>
        </div>
      </div>

      <div className="inline-actions">
        {[
          { value: "progress", label: "Progress" },
          { value: "compare", label: "Compare" },
          { value: "volume", label: "Volume" },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            className={strengthView === item.value ? "toggle active" : "toggle"}
            onClick={() => setStrengthView(item.value as StrengthViewMode)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {strengthView === "progress" ? renderProgressView() : null}
      {strengthView === "compare" ? renderCompareView() : null}
      {strengthView === "volume" ? renderVolumeView() : null}
    </>
  );
}

function DietView(props: {
  plans: Record<DietType, DietPlan | null>;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  selectedDietType: DietType;
  onSelectDietType: (dietType: DietType) => void;
  selectedWeek: PlanWeek;
  onSelectWeek: (week: PlanWeek) => void;
  onToggleMeal: (
    day: DietPlanDay,
    mealSlot: MealSlot,
    completed: boolean,
    dietType: DietType,
    mappedDate: string,
  ) => Promise<void>;
  onOpenRecipe: (entry: DietPlanEntry) => void;
  weekDays: WeekDay[];
  weekProgress: Record<string, ProgressDay>;
  weekWater: Record<string, UserWaterEntry>;
  pendingMealKey: string | null;
  pendingWaterDate: string | null;
  energyUnitPreference: EnergyUnit;
  mealTargetCount: number;
  hasConfiguredSupplements: boolean;
  onGenerateMissingDietType: (dietType: DietType) => Promise<void>;
  onRegenerateDietMode: (dietType: DietType, week: PlanWeek) => Promise<void>;
  generationStatus: SectionGenerationStatus | null;
  onSaveWater: (date: string, glassesCompleted: number) => Promise<void>;
}) {
  const plan = props.plans[props.selectedDietType];
  const isGeneratingDiet = props.generationStatus !== null;
  const renderDietModeControls = () => (
    <div className="diet-mode-actions">
      {dietTypeOptions.map((item) => {
        const redoLabel = item.value === "recipes" ? "Redo recipes" : "Redo single foods";
        const weekLabel = props.selectedWeek === "next" ? "next week" : "this week";

        return (
          <div key={item.value} className="diet-mode-control-group">
            <button
              type="button"
              className={item.value === props.selectedDietType ? "toggle active diet-mode-control" : "toggle diet-mode-control"}
              onClick={() => props.onSelectDietType(item.value)}
            >
              {item.label}
            </button>
            <button
              type="button"
              className="secondary-button diet-mode-redo"
              onClick={() => props.onRegenerateDietMode(item.value, props.selectedWeek)}
              disabled={isGeneratingDiet}
              aria-label={`${redoLabel} for ${weekLabel}`}
              title={`${redoLabel} for ${weekLabel}`}
            >
              <RefreshCcw02 className="button-icon" />
            </button>
          </div>
        );
      })}
    </div>
  );

  if (!plan) {
    return (
      <div className="stack-page">
        <section className="panel">
          <div className="panel-header split-end">
            <div>
              <span className="eyebrow">7-day diet</span>
              <h3>Select a saved table</h3>
              <p className="muted-line">Switch between single foods and recipes. If a table is missing, generate it once here.</p>
            </div>
            <div className="panel-header-aside">
              {props.generationStatus ? (
                <SectionGenerationCard kind="diet" status={props.generationStatus} />
              ) : null}
              <div className="inline-actions">
                <button
                  type="button"
                  className={props.selectedWeek === "current" ? "toggle active" : "toggle"}
                  onClick={() => props.onSelectWeek("current")}
                >
                  This week
                </button>
                <button
                  type="button"
                  className={props.selectedWeek === "next" ? "toggle active" : "toggle"}
                  onClick={() => props.onSelectWeek("next")}
                >
                  Next week
                </button>
              </div>
              {renderDietModeControls()}
            </div>
          </div>
        </section>

        <EmptyState
          title={`No ${props.selectedDietType === "recipes" ? "recipe" : "single-food"} week yet`}
          body="There is no data in this table yet. Generate it once and the meals view will render it immediately."
          actionLabel={isGeneratingDiet
            ? "Building table..."
            : `Generate ${props.selectedDietType === "recipes" ? "recipes" : "single foods"}`}
          onAction={() => props.onGenerateMissingDietType(props.selectedDietType)}
          actionDisabled={isGeneratingDiet}
        >
          {props.generationStatus ? (
            <SectionGenerationCard kind="diet" status={props.generationStatus} />
          ) : null}
        </EmptyState>
      </div>
    );
  }

  const activeDay = plan.days.find((day) => day.day === props.selectedDay) ?? plan.days[0];
  const activeDate = props.weekDays.find((item) => item.dayNumber === activeDay.day)?.date ?? todayKey();
  const activeProgress = props.weekProgress[activeDate];
  const activeWater = props.weekWater[activeDate];
  const visibleMeals = getRenderableMealConfig(activeDay);
  const isTrackableDay = activeDate === todayKey();
  const targetGlasses = activeWater?.targetGlasses ?? 0;
  const completedGlasses = activeWater?.glassesCompleted ?? 0;
  const completedLiters = activeWater?.completedLiters ?? 0;
  const waterTargetLiters = activeWater?.targetLiters ?? 0;

  return (
    <div className="stack-page">
      <section className="panel">
          <div className="panel-header split-end">
            <div>
              <span className="eyebrow">7-day diet</span>
              <h3>
                {formatEnergyValue(Math.round(plan.summary.dailyCalories * kilojoulesPerCalorie), props.energyUnitPreference)} target · {" "}
              {formatEnergyValue(activeProgress?.totals.kilojoulesConsumed ?? 0, props.energyUnitPreference)} consumed
            </h3>
            <p className="muted-line">
              Target: P {plan.summary.macros.protein} · C {plan.summary.macros.carbs} · F {plan.summary.macros.fats}
              {" · "}
              Consumed: P {activeProgress?.macroTotals.proteinGrams ?? 0}g · C {activeProgress?.macroTotals.carbsGrams ?? 0}g · F {activeProgress?.macroTotals.fatsGrams ?? 0}g
            </p>
          </div>
          <div className="panel-header-aside">
            {props.generationStatus ? (
              <SectionGenerationCard kind="diet" status={props.generationStatus} />
            ) : null}
            {renderDietModeControls()}
          </div>
          </div>

        <div className="day-strip">
          {plan.days.map((day) => (
            <button
              key={day.day}
              type="button"
              className={day.day === props.selectedDay ? "day-chip active" : "day-chip"}
              onClick={() => props.onSelectDay(day.day)}
            >
              <strong>{day.dayName}</strong>
              <span>{props.weekDays.find((item) => item.dayNumber === day.day)?.shortLabel}</span>
            </button>
          ))}
        </div>

        <div className="inline-actions diet-week-actions">
          <button
            type="button"
            className={props.selectedWeek === "current" ? "toggle active" : "toggle"}
            onClick={() => props.onSelectWeek("current")}
          >
            This week
          </button>
          <button
            type="button"
            className={props.selectedWeek === "next" ? "toggle active" : "toggle"}
            onClick={() => props.onSelectWeek("next")}
          >
            Next week
          </button>
        </div>
      </section>

      <section className="meals-grid">
        {visibleMeals.map((meal) => {
          const entries = meal.slot === "supplements"
            ? activeDay.supplements
            : [(activeDay[meal.slot] as DietPlanEntry)];
          const done = activeDay.eatenMeals?.[meal.slot] ?? false;
          const currentMealKey = `${activeDate}:${meal.slot}`;
          const primaryEntry = entries[0];
          const cardTitle = primaryEntry?.object ?? "Open slot";
          const mealLabel = meal.slot === "supplements"
            && props.mealTargetCount === 6
            && !props.hasConfiguredSupplements
            ? "Meal 6"
            : meal.title;

          return (
            <article key={meal.slot} className="panel meal-card">
              <div className="panel-header split-end">
                <div>
                  <span className="eyebrow">{mealLabel}</span>
                  <h3>{cardTitle}</h3>
                </div>
                <button
                  type="button"
                  className={done ? "check-button active" : "check-button"}
                  onClick={() => props.onToggleMeal(activeDay, meal.slot, !done, props.selectedDietType, activeDate)}
                  disabled={props.pendingMealKey === currentMealKey || !isTrackableDay}
                >
                  {props.pendingMealKey === currentMealKey
                    ? "Saving..."
                    : !isTrackableDay
                      ? "Locked"
                      : done ? "Eaten" : "Mark eaten"}
                </button>
              </div>

              {entries.map((entry, index) => (
                <div key={`${meal.slot}-${index}`} className="entry-block">
                  <p className="entry-description">{entry.description}</p>
                  {props.selectedDietType === "recipes" ? (
                    entry.instructions?.length ? (
                      <button
                        type="button"
                        className="recipe-button"
                        onClick={() => props.onOpenRecipe(entry)}
                      >
                        <span>Open recipe</span>
                        <ArrowRight className="button-icon" />
                      </button>
                    ) : (
                      <p className="muted-line">Recipe mode requires instructions for this meal.</p>
                    )
                  ) : null}
                  <div className="macro-line">
                    <span>{entry.quantity} {entry.quantityUnit}</span>
                    <span>{entry.macros.protein} protein</span>
                    <span>{entry.macros.carbs} carbs</span>
                    <span>{entry.macros.fats} fats</span>
                  </div>
                  <ul className="ingredient-list">
                    {entry.ingredients.map((ingredient) => (
                      <li key={`${entry.object}-${ingredient.item}`}>
                        <strong>{ingredient.item}</strong>
                        <span>{ingredient.quantity} {ingredient.quantityUnit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </article>
          );
        })}
      </section>

      <section className="panel water-panel">
        <div className="panel-header split-end">
          <div>
            <span className="eyebrow">Water</span>
            <h3>{targetGlasses} glass{targetGlasses === 1 ? "" : "es"} target</h3>
            <p className="muted-line">
              {completedLiters} / {waterTargetLiters} L completed
            </p>
          </div>
          <div className="water-panel-copy">
            <span>Minimal requirement for this day</span>
            {!isTrackableDay ? <span>Locked until this day is active</span> : null}
          </div>
        </div>

        <div className="water-glass-grid">
          {Array.from({ length: targetGlasses }, (_, index) => {
            const filled = index < completedGlasses;
            const nextCompleted = completedGlasses > index ? index : index + 1;

            return (
              <button
                key={`${activeDate}-water-${index + 1}`}
                type="button"
                className={filled ? "water-glass-button filled" : "water-glass-button"}
                onClick={() => props.onSaveWater(activeDate, nextCompleted)}
                disabled={props.pendingWaterDate === activeDate || activeDate > todayKey()}
                aria-label={`Glass ${index + 1} of ${targetGlasses}`}
              >
                <img
                  src={filled ? "/water-glass-full.svg" : "/water-glass-empty.svg"}
                  alt=""
                  aria-hidden="true"
                />
                <span>{index + 1}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function WorkoutView(props: {
  plan: WorkoutPlan | null;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  selectedWeek: PlanWeek;
  onSelectWeek: (week: PlanWeek) => void;
  onToggleWorkout: (day: WorkoutPlanDay, completed: boolean, mappedDate: string) => Promise<void>;
  exerciseLogsByDate: Record<string, ExerciseLogDraft[]>;
  onUpdateExerciseLogs: (date: string, logs: ExerciseLogDraft[]) => void;
  onRegenerateWorkout: () => void;
  weekDays: WeekDay[];
  weekProgress: Record<string, ProgressDay>;
  pendingWorkoutDay: number | null;
  energyUnitPreference: EnergyUnit;
  generationStatus: SectionGenerationStatus | null;
}) {
  const weekSwitchButtons = (
    <div className="inline-actions diet-week-actions">
      <button
        type="button"
        className={props.selectedWeek === "current" ? "toggle active" : "toggle"}
        onClick={() => props.onSelectWeek("current")}
      >
        This week
      </button>
      <button
        type="button"
        className={props.selectedWeek === "next" ? "toggle active" : "toggle"}
        onClick={() => props.onSelectWeek("next")}
      >
        Next week
      </button>
    </div>
  );

  if (!props.plan) {
    return (
      <EmptyState
        title="No workout week yet"
        body="Generate a workout-only block to unlock weekly sessions, burn estimates, and workout check-offs."
        actionLabel={props.generationStatus ? "Updating workout..." : "Build workout"}
        onAction={props.onRegenerateWorkout}
        actionDisabled={props.generationStatus !== null}
      >
        {weekSwitchButtons}
        {props.generationStatus ? (
          <SectionGenerationCard kind="workout" status={props.generationStatus} />
        ) : null}
      </EmptyState>
    );
  }

  const activeDay = props.plan.days.find((day) => day.day === props.selectedDay) ?? props.plan.days[0];
  const activeDate = props.weekDays.find((item) => item.dayNumber === activeDay.day)?.date ?? todayKey();
  const isTrackableDay = activeDate === todayKey();
  const exerciseLogs = mergeExerciseLogDrafts(
    activeDay,
    activeDate,
    props.exerciseLogsByDate[activeDate],
  );
  const workoutCompleted = activeDay.completed ?? false;

  return (
    <div className="stack-page">
      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Training week</span>
            <h3>{props.plan.overview.split}</h3>
            <p className="muted-line">
              {props.plan.overview.avgDuration} average · {formatEnergyValue(
                props.plan.overview.estimatedWeeklyKilojoulesBurned
                  ?? Math.round((props.plan.overview.estimatedWeeklyCaloriesBurned ?? 0) * kilojoulesPerCalorie),
                props.energyUnitPreference,
              )} weekly burn
            </p>
          </div>
          <div className="panel-header-aside">
            {props.generationStatus ? (
              <SectionGenerationCard kind="workout" status={props.generationStatus} />
            ) : null}
            <button
              type="button"
              className="secondary-button"
              onClick={props.onRegenerateWorkout}
              disabled={props.generationStatus !== null}
            >
              <RefreshCcw02 className="button-icon" />
              {props.generationStatus ? "Updating workout..." : "Redo workout"}
            </button>
          </div>
        </div>

        <div className="day-strip">
          {props.plan.days.map((day) => (
            <button
              key={day.day}
              type="button"
              className={day.day === props.selectedDay ? "day-chip active" : "day-chip"}
              onClick={() => props.onSelectDay(day.day)}
            >
              <strong>{day.dayName}</strong>
              <span>{formatEnergyValue(
                day.estimatedKilojoulesBurned
                  ?? Math.round((day.estimatedCaloriesBurned ?? 0) * kilojoulesPerCalorie),
                props.energyUnitPreference,
              )}</span>
            </button>
          ))}
        </div>
        {weekSwitchButtons}
      </section>

      <section className="panel">
        <div className="panel-header split-end">
          <div>
            <span className="eyebrow">{activeDay.dayName}</span>
            <h3>{activeDay.focus}</h3>
            <p className="muted-line">
              {activeDay.totalDuration} · {formatEnergyValue(
                activeDay.estimatedKilojoulesBurned
                  ?? Math.round((activeDay.estimatedCaloriesBurned ?? 0) * kilojoulesPerCalorie),
                props.energyUnitPreference,
              )} burn
            </p>
          </div>
            <button
              type="button"
              className={workoutCompleted ? "check-button active" : "check-button"}
              onClick={() => props.onToggleWorkout(activeDay, !workoutCompleted, activeDate)}
              disabled={props.pendingWorkoutDay === activeDay.day || !isTrackableDay}
            >
            {props.pendingWorkoutDay === activeDay.day
              ? "Saving..."
              : !isTrackableDay
                ? "Locked"
                : workoutCompleted ? "Completed" : "Mark complete"}
          </button>
        </div>

        <div className="workout-columns">
          <div className="stack">
            <div className="subpanel">
              <strong>Warm-up</strong>
              <ul>
                {(activeDay.warmUp ?? []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>

            <div className="subpanel">
              <strong>Cool-down</strong>
              <ul>
                {(activeDay.coolDown ?? []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>

          <div className="exercise-list">
            {activeDay.exercises.map((exercise) => {
              const exerciseLog = exerciseLogs.find((log) => log.exerciseName === exercise.name) ?? {
                date: activeDate,
                exerciseName: exercise.name,
                setsCompleted: parsePlannedCount(exercise.sets),
                repsCompleted: parsePlannedCount(exercise.reps),
                weightUsed: 0,
                volume: 0,
              };
              const inputsDisabled = workoutCompleted
                || !isTrackableDay
                || props.pendingWorkoutDay === activeDay.day;

              const updateExerciseLog = (
                field: "setsCompleted" | "repsCompleted" | "weightUsed",
                value: number,
              ) => {
                const nextLogs = exerciseLogs.map((log) => {
                  if (log.exerciseName !== exercise.name) {
                    return log;
                  }

                  const nextLog = {
                    ...log,
                    [field]: value,
                  };

                  return {
                    ...nextLog,
                    volume: calculateExerciseVolume(
                      nextLog.setsCompleted,
                      nextLog.repsCompleted,
                      nextLog.weightUsed,
                    ),
                  };
                });

                props.onUpdateExerciseLogs(activeDate, nextLogs);
              };

              return (
                <article key={exercise.name} className="exercise-card">
                  <div className="exercise-header">
                    <h4>{exercise.name}</h4>
                    <span>{exercise.sets} x {exercise.reps}</span>
                  </div>
                  <p>{exercise.notes}</p>
                  <div className="macro-line">
                    <span>Rest {exercise.rest}</span>
                    <span>{exercise.alternatives?.join(" · ") || "No alternatives"}</span>
                  </div>
                  <div className="exercise-log-grid">
                    <label className="exercise-log-field">
                      <span>Sets done</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={exerciseLog.setsCompleted}
                        onChange={(event) => updateExerciseLog(
                          "setsCompleted",
                          Math.max(0, Number(event.target.value) || 0),
                        )}
                        disabled={inputsDisabled}
                      />
                    </label>
                    <label className="exercise-log-field">
                      <span>Reps done</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={exerciseLog.repsCompleted}
                        onChange={(event) => updateExerciseLog(
                          "repsCompleted",
                          Math.max(0, Number(event.target.value) || 0),
                        )}
                        disabled={inputsDisabled}
                      />
                    </label>
                    <label className="exercise-log-field">
                      <span>Weight used</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={exerciseLog.weightUsed}
                        onChange={(event) => updateExerciseLog(
                          "weightUsed",
                          Math.max(0, Number(event.target.value) || 0),
                        )}
                        disabled={inputsDisabled}
                      />
                    </label>
                  </div>
                  <div className="macro-line">
                    <span>Volume {formatNumber(exerciseLog.volume)}</span>
                    <span>{!isTrackableDay ? "Available only on today's date" : workoutCompleted ? "Workout saved" : "Saved when completed"}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function ShoppingView(props: {
  shoppingLists: Record<PlanWeek, Record<DietType, ShoppingList | null>>;
  selectedDietType: DietType;
  onSelectDietType: (dietType: DietType) => void;
  selectedWeek: PlanWeek;
  onSelectWeek: (week: PlanWeek) => void;
  onToggleItem: (item: ShoppingItem, checked: boolean) => Promise<void>;
  pendingItemId: string | null;
}) {
  const shoppingList = props.shoppingLists[props.selectedWeek][props.selectedDietType];
  const weekSwitchButtons = (
    <div className="shopping-week-actions">
      {planWeeks.map((week) => (
        <button
          key={week}
          type="button"
          className={week === props.selectedWeek ? "toggle active" : "toggle"}
          onClick={() => props.onSelectWeek(week)}
        >
          {week === "current" ? "This week" : "Next week"}
        </button>
      ))}
    </div>
  );

  if (!shoppingList) {
    return (
      <EmptyState
        title={`No ${props.selectedWeek === "next" ? "next-week" : "current-week"} ${props.selectedDietType === "recipes" ? "recipe" : "single-food"} market list yet`}
        body="That market table has not been generated yet. Current and next-week lists are stored separately for each diet mode."
      >
        {weekSwitchButtons}
      </EmptyState>
    );
  }

  const entries = Object.entries(shoppingList.categories);

  return (
    <div className="view-grid">
      <section className="panel span-2">
        <div className="panel-header split-end">
          <div>
            <span className="eyebrow">Weekly market list</span>
            <h3>{shoppingList.metadata.totalItems} items for {shoppingList.metadata.daysCovered ?? 7} days</h3>
          </div>
          <div className="inline-actions">
            {dietTypeOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                className={item.value === props.selectedDietType ? "toggle active" : "toggle"}
                onClick={() => props.onSelectDietType(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="stats-grid">
          <MetricCard
            title="Estimated cost"
            value={`$${shoppingList.metadata.estimatedCost} ${shoppingList.metadata.currency ?? "AUD"}`}
            detail={shoppingList.metadata.recommendedStore
              ? `${shoppingList.metadata.recommendedStore} looks cheapest`
              : "AI estimate"}
          />
          <MetricCard title="Store sections" value={String(shoppingList.metadata.storeSections)} detail={shoppingList.metadata.prepTime} />
          <MetricCard title="Batch items" value={String(shoppingList.mealPrepStrategy.batchCookItems.length)} detail={firstOrEmpty(shoppingList.mealPrepStrategy.batchCookItems)} />
          <MetricCard title="Pantry staples" value={String(shoppingList.pantryChecklist.length)} detail={firstOrEmpty(shoppingList.pantryChecklist)} />
        </div>
        {shoppingList.metadata.estimatedCostAudByStore ? (
          <div className="store-price-grid">
            <MetricCard title="Coles" value={`$${shoppingList.metadata.estimatedCostAudByStore.coles}`} detail="Estimated basket" />
            <MetricCard title="Woolworths" value={`$${shoppingList.metadata.estimatedCostAudByStore.woolworths}`} detail="Estimated basket" />
            <MetricCard title="Aldi" value={`$${shoppingList.metadata.estimatedCostAudByStore.aldi}`} detail="Estimated basket" />
          </div>
        ) : null}
        {weekSwitchButtons}
      </section>

      {entries.map(([category, items]) => (
        <section key={category} className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">{titleCase(category)}</span>
              <h3>{items.length} items</h3>
            </div>
          </div>
          <ul className="shopping-list">
            {items.length > 0 ? items.map((item: ShoppingItem) => (
              <li key={`${category}-${item.item}`} className={item.checked ? "shopping-item checked" : "shopping-item"}>
                <button
                  type="button"
                  className={item.checked ? "shopping-check active" : "shopping-check"}
                  onClick={() => props.onToggleItem(item, !item.checked)}
                  disabled={!item.id || props.pendingItemId === item.id}
                >
                  {props.pendingItemId === item.id ? "..." : item.checked ? "Done" : "Mark"}
                </button>
                <strong>{item.item}</strong>
                <span>{item.quantity} {item.quantityUnit}</span>
              </li>
            )) : <li className="empty-line">Nothing in this section.</li>}
          </ul>
        </section>
      ))}

      <section className="panel span-2">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Store route</span>
            <h3>By section</h3>
          </div>
        </div>
        <div className="store-sections">
          {shoppingList.byStoreSection.map((section) => (
            <article key={section.section} className="subpanel">
              <strong>{section.section}</strong>
              <ul>
                {section.items.map((item) => (
                  <li key={`${section.section}-${item.item}`}>
                    {item.item} · {item.quantity} {item.quantityUnit}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.55-5.17 3.55-8.66Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.01c-1.07.72-2.45 1.14-4.07 1.14-3.13 0-5.79-2.11-6.74-4.95H1.25v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.26 14.28A7.2 7.2 0 0 1 4.88 12c0-.79.14-1.56.38-2.28V6.63H1.25A12 12 0 0 0 0 12c0 1.94.46 3.78 1.25 5.37l4.01-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.36.61 4.61 1.8l3.46-3.46C17.95 1.13 15.23 0 12 0A12 12 0 0 0 1.25 6.63l4.01 3.09c.95-2.84 3.61-4.95 6.74-4.95Z"
      />
    </svg>
  );
}

function GoogleAuthButton(props: {
  busy: boolean;
  onCredential: (idToken: string) => Promise<void>;
  variant: "icon" | "signup" | "signin";
  showBusyText?: boolean;
}) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

  useEffect(() => {
    if (!googleClientId || !buttonRef.current) {
      return;
    }

    let cancelled = false;

    const renderButton = () => {
      if (cancelled || !buttonRef.current || !window.google?.accounts.id) {
        return;
      }

      buttonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (response.credential) {
            void props.onCredential(response.credential);
          }
        },
      });
      window.google.accounts.id.renderButton(
        buttonRef.current,
        props.variant === "icon"
          ? {
            type: "icon",
            theme: "outline",
            shape: "circle",
            size: "large",
          }
          : {
            type: "standard",
            theme: "outline",
            text: props.variant === "signup" ? "signup_with" : "signin_with",
            shape: "pill",
            size: "large",
            width: 320,
          },
      );
    };

    void loadGoogleIdentityScript()
      .then(renderButton)
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [googleClientId, props.onCredential, props.variant]);

  const label = props.variant === "signup"
    ? "Sign up with Google"
    : props.variant === "signin"
      ? "Sign in with Google"
      : "Continue with Google";

  const fallbackClassName = props.variant === "icon"
    ? "google-fallback-button google-fallback-button-icon"
    : "google-fallback-button google-fallback-button-wide";

  return (
    <div className={props.variant === "icon" ? "google-auth-block google-auth-block-icon" : "google-auth-block"}>
      {googleClientId ? (
        <div className={props.busy ? "google-shell is-busy" : "google-shell"}>
          <div ref={buttonRef} aria-label={label} />
        </div>
      ) : (
        <button type="button" className={fallbackClassName} disabled aria-disabled="true">
          <GoogleMark />
          {props.variant === "icon" ? null : <span>{label}</span>}
        </button>
      )}
      {props.showBusyText && props.busy ? <small>Verifying Google account...</small> : null}
      {!googleClientId ? <small>Add `VITE_GOOGLE_CLIENT_ID` to enable Google sign-in.</small> : null}
    </div>
  );
}

function RecipeModal(props: {
  recipePreview: {
    title: string;
    description: string;
    instructions: string[];
    preparationTimeMinutes?: number;
  } | null;
  onClose: () => void;
}) {
  if (!props.recipePreview) {
    return null;
  }

  return (
    <div className="recipe-modal-backdrop" onClick={props.onClose} role="presentation">
      <section
        className="recipe-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="panel-header split-end">
          <div>
            <span className="eyebrow">Recipe flow</span>
            <h3>{props.recipePreview.title}</h3>
            <p className="muted-line">{props.recipePreview.description}</p>
          </div>
          <button type="button" className="ghost-close" onClick={props.onClose}>
            Close
          </button>
        </div>

        <div className="recipe-meta">
          <span>{props.recipePreview.instructions.length} steps</span>
          <span>
            {props.recipePreview.preparationTimeMinutes
              ? `${props.recipePreview.preparationTimeMinutes} min prep`
              : "Prep time flexible"}
          </span>
        </div>

        <ol className="recipe-steps">
          {props.recipePreview.instructions.map((instruction) => (
            <li key={instruction}>{instruction}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function ProfileEditor(props: {
  draft: ProfileDraft;
  onChange: (draft: ProfileDraft) => void;
  onSave: () => void;
  onSaveAndGenerate: () => void;
  busyAction: string | null;
  isRegeneratingPlan?: boolean;
  compact?: boolean;
}) {
  const { draft } = props;

  const updateField = (field: keyof ProfileDraft, value: string) => {
    props.onChange({ ...draft, [field]: value });
  };

  return (
    <div className={props.compact ? "settings-layout" : "onboarding-layout"}>
      <section className="panel span-2">
        <div className="panel-header">
          <div>
            <span className="eyebrow">{props.compact ? "Settings" : "Assessment"}</span>
            <h3>{props.compact ? "Edit your inputs" : "Fill your profile to unlock the week"}</h3>
            <p className="muted-line">
              Keep arrays comma-separated. Example: `rice, chicken, berries`
            </p>
          </div>
        </div>

        <div className="form-grid">
          <Field label="Name">
            <input value={draft.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Carlos Mendez" />
          </Field>
          <Field label="Age">
            <input type="number" value={draft.age} onChange={(event) => updateField("age", event.target.value)} placeholder="28" />
          </Field>
          <Field label="Gender">
            <select value={draft.gender} onChange={(event) => updateField("gender", event.target.value)}>
              {profileOptions.genders.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
            </select>
          </Field>
          <Field label="Weight (kg)">
            <input type="number" value={draft.weight} onChange={(event) => updateField("weight", event.target.value)} placeholder="75" />
          </Field>
          <Field label="Target weight (kg)">
            <input type="number" value={draft.targetWeight} onChange={(event) => updateField("targetWeight", event.target.value)} placeholder="68" />
          </Field>
          <Field label="Height (cm)">
            <input type="number" value={draft.height} onChange={(event) => updateField("height", event.target.value)} placeholder="178" />
          </Field>
          <Field label="Goal">
            <select value={draft.goal} onChange={(event) => updateField("goal", event.target.value)}>
              {profileOptions.goals.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
            </select>
          </Field>
          <Field label="Diet">
            <select value={draft.diet} onChange={(event) => updateField("diet", event.target.value)}>
              {profileOptions.diets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Cheat weekly meal">
            <select value={draft.cheatWeeklyMeal} onChange={(event) => updateField("cheatWeeklyMeal", event.target.value as ProfileDraft["cheatWeeklyMeal"])}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Diet mode">
            <select value={draft.kindOfDiet} onChange={(event) => updateField("kindOfDiet", event.target.value as DietType)}>
              {dietTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Activity level">
            <select value={draft.levelActivity} onChange={(event) => updateField("levelActivity", event.target.value)}>
              {profileOptions.activityLevels.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
            </select>
          </Field>
          <Field label="Train location">
            <select value={draft.trainLocation} onChange={(event) => updateField("trainLocation", event.target.value)}>
              {profileOptions.locations.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
            </select>
          </Field>
          <Field label="Time to train (minutes)">
            <input type="number" value={draft.timeToTrain} onChange={(event) => updateField("timeToTrain", event.target.value)} placeholder="45" />
          </Field>
          <Field label="Daily foods">
            <input
              type="number"
              min={mealsPerDayMin}
              max={mealsPerDayMax}
              value={draft.numberOfMeals}
              onChange={(event) => updateField("numberOfMeals", event.target.value)}
              placeholder="4"
            />
          </Field>
          <Field label="Energy unit">
            <select
              value={draft.energyUnitPreference}
              onChange={(event) => updateField("energyUnitPreference", event.target.value as EnergyUnit)}
            >
              {energyUnitOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Favorite foods">
            <textarea value={draft.favoriteFoods} onChange={(event) => updateField("favoriteFoods", event.target.value)} placeholder="chicken, rice, berries" />
          </Field>
          <Field label="Supplements">
            <textarea value={draft.supplementation} onChange={(event) => updateField("supplementation", event.target.value)} placeholder="creatine, whey protein, vitamin d" />
          </Field>
          <Field label="Avoided foods">
            <textarea value={draft.avoidedFoods} onChange={(event) => updateField("avoidedFoods", event.target.value)} placeholder="pork, soda" />
          </Field>
          <Field label="Allergies">
            <textarea value={draft.allergies} onChange={(event) => updateField("allergies", event.target.value)} placeholder="peanuts" />
          </Field>
          <Field label="Injuries">
            <textarea value={draft.injuries} onChange={(event) => updateField("injuries", event.target.value)} placeholder="shoulder discomfort" />
          </Field>
          <Field label="Cuisine preferences">
            <textarea value={draft.favorieteCoucineRecipes} onChange={(event) => updateField("favorieteCoucineRecipes", event.target.value)} placeholder="mediterranean, latin" />
          </Field>
        </div>

        <div className="inline-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={props.onSave}
            disabled={props.busyAction === "save"}
          >
            <CheckCircle className="button-icon" />
            {props.busyAction === "save" ? "Saving..." : "Save only"}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={props.onSaveAndGenerate}
            disabled={props.busyAction === "save" || props.isRegeneratingPlan}
          >
            <Zap className="button-icon" />
            {props.isRegeneratingPlan
              ? (props.compact ? "Redoing plan..." : "Building your week...")
              : (props.compact ? "Redo plan" : "Save and build week")}
          </button>
        </div>
      </section>
    </div>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}

function MetricCard(props: { title: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <span>{props.title}</span>
      <strong>{props.value}</strong>
      <small>{props.detail}</small>
    </article>
  );
}

function SummaryCard(props: {
  summary: ProgressSummary | null;
  wide?: boolean;
  energyUnitPreference: EnergyUnit;
}) {
  if (!props.summary || props.summary.totals.trackedDays === 0) {
    return <p className="empty-line">No tracked entries yet.</p>;
  }

  return (
    <div className={props.wide ? "summary-card wide" : "summary-card"}>
      <div className="stats-grid summary-stats">
        <MetricCard title="Tracked days" value={String(props.summary.totals.trackedDays)} detail={props.summary.period} />
        <MetricCard title="Consumed" value={formatEnergyValue(props.summary.totals.kilojoulesConsumed, props.energyUnitPreference)} detail={formatEnergyValue(props.summary.totals.kilojoulesConsumed, "kj")} />
        <MetricCard title="Burned" value={formatEnergyValue(props.summary.totals.kilojoulesBurned, props.energyUnitPreference)} detail={formatEnergyValue(props.summary.totals.kilojoulesBurned, "kj")} />
        <MetricCard title="Meals completed" value={String(props.summary.totals.mealsCompleted)} detail={`${props.summary.totals.workoutsCompleted} workouts`} />
      </div>
      <div className="breakdown-list">
        {props.summary.breakdown.slice(-6).map((row) => (
          <div key={`${row.rangeStart}-${row.label}`} className="mini-row">
            <div>
              <strong>{row.label}</strong>
              <span>{row.trackedDays} tracked days</span>
            </div>
            <div className="mini-row-values">
              <span>{formatEnergyValue(row.kilojoulesConsumed, props.energyUnitPreference)} in</span>
              <span>{formatEnergyValue(row.kilojoulesBurned, props.energyUnitPreference)} out</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState(props: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="panel empty-state">
      <span className="empty-icon">
        <Package />
      </span>
      <span className="eyebrow">Nothing saved yet</span>
      <h3>{props.title}</h3>
      <p>{props.body}</p>
      {props.children}
      {props.onAction ? (
        <button
          type="button"
          className="secondary-button"
          onClick={props.onAction}
          disabled={props.actionDisabled}
        >
          {props.actionLabel}
        </button>
      ) : null}
    </section>
  );
}

export default App;
