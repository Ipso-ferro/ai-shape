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
  CalendarCheck02,
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
import { formatNumber, getCurrentWeek, humanDate, isSunday, monthKey, todayKey } from "./date";
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
  MealSlot,
  PlanWeek,
  ProfileDraft,
  ProgressDay,
  ProgressSummary,
  ShoppingItem,
  ShoppingList,
  StoredSession,
  UserProfile,
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
const workoutRefreshStoragePrefix = "ai-shape-workout-refresh";
const generationStoragePrefix = "ai-shape-generation";
const generationStatusTtlMs = 1000 * 60 * 30;

type SectionGenerationKind = "diet" | "workout";
type SectionGenerationSource = "redo-plan" | "diet-mode" | "redo-workout" | "auto-workout";

interface SectionGenerationStatus {
  source: SectionGenerationSource;
  title: string;
  message: string;
  startedAt: string;
  dietType?: DietType;
}

const emptyDraft: ProfileDraft = {
  name: "",
  age: "",
  gender: "female",
  weight: "",
  height: "",
  goal: "fat-loss",
  diet: "omnivore",
  kindOfDiet: "single-food",
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

const toCalories = (kilojoules: number): number => Math.round(kilojoules / kilojoulesPerCalorie);

const getEnergyUnitLabel = (energyUnit: EnergyUnit): string => (
  energyUnit === "cal" ? "kcal" : "kJ"
);

const formatEnergyValue = (kilojoules: number, energyUnit: EnergyUnit): string => (
  `${formatNumber(energyUnit === "cal" ? toCalories(kilojoules) : kilojoules)} ${getEnergyUnitLabel(energyUnit)}`
);

const splitList = (value: string): string[] => value
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const buildWorkoutRefreshStorageKey = (userId: string): string => (
  `${workoutRefreshStoragePrefix}:${userId}`
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

const shouldAutoRefreshWorkout = (userId: string, referenceDate = new Date()): boolean => {
  if (typeof window === "undefined" || !isSunday(referenceDate)) {
    return false;
  }

  return window.localStorage.getItem(buildWorkoutRefreshStorageKey(userId)) !== monthKey(referenceDate);
};

const markWorkoutRefreshMonth = (userId: string, referenceDate = new Date()): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(buildWorkoutRefreshStorageKey(userId), monthKey(referenceDate));
};

const isProfileReady = (user: UserProfile): boolean => (
  user.name.trim().length > 0
  && user.age > 0
  && user.weight > 0
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
    height: String(user.height || ""),
    goal: user.goal || "fat-loss",
    diet: user.diet || "omnivore",
    kindOfDiet: (user.kindOfDiet === "recipes" ? "recipes" : "single-food"),
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
  height: Number(draft.height),
  goal: draft.goal,
  diet: draft.diet,
  kindOfDiet: draft.kindOfDiet,
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

const dayDateMap = (weekDays: WeekDay[]): Record<number, string> => (
  weekDays.reduce<Record<number, string>>((accumulator, item) => {
    accumulator[item.dayNumber] = item.date;
    return accumulator;
  }, {})
);

const firstOrEmpty = (list: string[]): string => list[0] ?? "No notes yet";

const resolveCurrentDietType = (user: UserProfile | null): DietType => (
  user?.kindOfDiet === "recipes" ? "recipes" : "single-food"
);

const createEmptyDietPlans = (): Record<DietType, DietPlan | null> => ({
  "single-food": null,
  recipes: null,
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

const patchDietPlansMealState = (
  dietPlans: Record<DietType, DietPlan | null>,
  dietType: DietType,
  dayNumber: number,
  mealSlot: MealSlot,
  completed: boolean,
): Record<DietType, DietPlan | null> => {
  const plan = dietPlans[dietType];

  if (!plan) {
    return dietPlans;
  }

  return {
    ...dietPlans,
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
  const [dietPlans, setDietPlans] = useState<Record<DietType, DietPlan | null>>(createEmptyDietPlans);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [shoppingLists, setShoppingLists] = useState<Record<PlanWeek, Record<DietType, ShoppingList | null>>>(createEmptyShoppingLists);
  const [todayProgress, setTodayProgress] = useState<ProgressDay | null>(null);
  const [monthSummary, setMonthSummary] = useState<ProgressSummary | null>(null);
  const [yearSummary, setYearSummary] = useState<ProgressSummary | null>(null);
  const [weekProgress, setWeekProgress] = useState<Record<string, ProgressDay>>({});
  const [selectedDietDay, setSelectedDietDay] = useState(defaultSelectedDay);
  const [selectedDietType, setSelectedDietType] = useState<DietType>("single-food");
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState(defaultSelectedDay);
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
  const autoWorkoutRefreshAttemptRef = useRef<string | null>(null);
  const activeSessionUserIdRef = useRef<string | null>(null);

  const weekDays = getCurrentWeek();
  const today = todayKey();
  const weekByNumber = dayDateMap(weekDays);
  const currentWeekPosition = weekDays.find((day) => day.date === today)?.dayNumber ?? 1;
  const profileComplete = user ? isProfileReady(user) : false;
  const activeDietType = resolveCurrentDietType(user);
  const activeCurrentShoppingList = shoppingLists.current[activeDietType];
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
    if (!sessionUserId || !user || !isProfileReady(user) || isRefreshingWorkout) {
      return;
    }

    if (!shouldAutoRefreshWorkout(sessionUserId)) {
      return;
    }

    const refreshAttemptKey = `${sessionUserId}:${monthKey()}`;
    if (autoWorkoutRefreshAttemptRef.current === refreshAttemptKey) {
      return;
    }

    autoWorkoutRefreshAttemptRef.current = refreshAttemptKey;
    void regenerateWorkoutPlan({ automatic: true });
  }, [isRefreshingWorkout, sessionUserId, user]);

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
    setWorkoutPlan(null);
    setShoppingLists(createEmptyShoppingLists());
    setTodayProgress(null);
    setMonthSummary(null);
    setYearSummary(null);
    setWeekProgress({});
    setSelectedDietType("single-food");
    setSelectedShoppingDietType("single-food");
    setSelectedShoppingWeek("current");
    setProfileDraft(emptyDraft);
    setActiveView("dashboard");
    setRecipePreview(null);
    setPendingMealKey(null);
    setPendingWorkoutDay(null);
    setPendingShoppingItemId(null);
    setDietGenerationStatus(null);
    setWorkoutGenerationStatus(null);
    autoWorkoutRefreshAttemptRef.current = null;
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
      const [singleFoodDiet, recipeDiet, freshWorkout, singleFoodShoppingCurrent, recipeShoppingCurrent, singleFoodShoppingNext, recipeShoppingNext, freshToday, freshMonth, freshYear] = await Promise.all([
        api.getDietPlan(userId, { dietType: "single-food" }),
        api.getDietPlan(userId, { dietType: "recipes" }),
        api.getWorkoutPlan(userId),
        api.getShoppingList(userId, { dietType: "single-food", week: "current" }),
        api.getShoppingList(userId, { dietType: "recipes", week: "current" }),
        api.getShoppingList(userId, { dietType: "single-food", week: "next" }),
        api.getShoppingList(userId, { dietType: "recipes", week: "next" }),
        api.getProgressDay(userId, today),
        api.getProgressSummary(userId, "month", today),
        api.getProgressSummary(userId, "year", today),
      ]);
      const activeDietType = resolveCurrentDietType(freshUser);

      const progressDays = await Promise.all(
        weekDays.map(async (weekDay) => {
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
          "single-food": singleFoodDiet ? withDietMealStateDefaults(singleFoodDiet) : null,
          recipes: recipeDiet ? withDietMealStateDefaults(recipeDiet) : null,
        });
        setWorkoutPlan(freshWorkout);
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
    const [freshToday, freshMonth, freshYear, progressDays] = await Promise.all([
      api.getProgressDay(userId, today),
      api.getProgressSummary(userId, "month", today),
      api.getProgressSummary(userId, "year", today),
      Promise.all(
        weekDays.map(async (weekDay) => [weekDay.date, await api.getProgressDay(userId, weekDay.date)] as const),
      ),
    ]);

    const nextWeekProgress = Object.fromEntries(progressDays);

    startTransition(() => {
      setTodayProgress(freshToday);
      setMonthSummary(freshMonth);
      setYearSummary(freshYear);
      setWeekProgress(nextWeekProgress);
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
        const week = options.week ?? "current";
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

      if (week === "current") {
        setDietPlans((current) => ({
          ...current,
          [dietType]: hydratedDietPlan,
        }));
      }
    }

    if (result.workoutPlan) {
      setWorkoutPlan(result.workoutPlan);
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

  async function regenerateWeek(dietType: DietType) {
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
      const result = await api.generateCompletePlan(requestUserId, dietType, "current");

      if (isCurrentSession(requestUserId)) {
        hydrateGeneratedPlans(result, dietType, "current");
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

  async function generateMissingDietMode(dietType: DietType) {
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
        week: "current",
        activateDietType: false,
      });

      if (isCurrentSession(requestUserId)) {
        setDietPlans((current) => ({
          ...current,
          [dietType]: withDietMealStateDefaults(generatedDietPlan),
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

  async function regenerateWorkoutPlan(options?: { automatic?: boolean }) {
    if (!sessionUserId || isRefreshingWorkout) {
      return;
    }

    const requestUserId = sessionUserId;
    const automatic = options?.automatic ?? false;
    syncWorkoutGenerationStatus(requestUserId, {
      source: automatic ? "auto-workout" : "redo-workout",
      title: automatic ? "Refreshing monthly workout" : "Updating workout plan",
      message: automatic
        ? "Sunday auto-refresh is updating this month's workout block in the background."
        : "Rebuilding your workout block in the background.",
      startedAt: new Date().toISOString(),
    });

    if (!automatic) {
      setErrorMessage(null);
    }

    try {
      const generatedWorkoutPlan = await api.generateWorkoutPlan(requestUserId);

      if (isCurrentSession(requestUserId)) {
        setWorkoutPlan(generatedWorkoutPlan);
      }

      markWorkoutRefreshMonth(requestUserId);
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
  ) {
    if (!sessionUserId) {
      return;
    }

    const mappedDate = weekByNumber[day.day];
    const mealKey = `${mappedDate}:${mealSlot}`;
    const previousDietPlans = dietPlans;
    setDietPlans((current) => patchDietPlansMealState(current, dietType, day.day, mealSlot, completed));
    setPendingMealKey(mealKey);

    mealActionQueueRef.current = mealActionQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const result = await api.toggleMeal(sessionUserId, mealSlot, mappedDate, completed, {
          dietType,
          week: "current",
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

  async function toggleWorkout(day: WorkoutPlanDay, completed: boolean) {
    if (!sessionUserId) {
      return;
    }

    const mappedDate = weekByNumber[day.day];
    setPendingWorkoutDay(day.day);

    try {
      const result = await api.toggleWorkout(sessionUserId, mappedDate, completed);
      setWeekProgress((current) => ({ ...current, [mappedDate]: result }));

      if (mappedDate === today) {
        setTodayProgress(result);
      }

      await refreshProgress(sessionUserId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update workout progress");
    } finally {
      setPendingWorkoutDay(null);
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
          <section className="hero-banner">
          <div>
            <span className="eyebrow">Today at a glance</span>
            <h2>
              {profileComplete
                ? "A live board for your food, training, and recovery signals."
                : "Complete the intake first. Then the weekly dashboard comes alive."}
            </h2>
            <p>
              Track eaten meals, completed sessions, your weekly market list, and tune the plan
              from the same workspace.
            </p>
          </div>
          <div className="hero-stats">
            <article>
              <span className="hero-stat-icon">
                <Target04 />
              </span>
              <div className="hero-stat-copy">
                <span>Diet Mode</span>
                <strong>{user.kindOfDiet === "recipes" ? "Recipes" : "Single foods"}</strong>
              </div>
            </article>
            <article>
              <span className="hero-stat-icon">
                <Zap />
              </span>
              <div className="hero-stat-copy">
                <span>Daily Target</span>
                <strong>{formatEnergyValue(user.kilojoulesTarget, user.energyUnitPreference)}</strong>
              </div>
            </article>
            <article>
              <span className="hero-stat-icon">
                <CalendarCheck02 />
              </span>
              <div className="hero-stat-copy">
                <span>Week Coverage</span>
                <strong>{currentWeekPosition}/7</strong>
              </div>
            </article>
          </div>
        </section>

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
                shoppingList={activeCurrentShoppingList}
                onGenerate={() => regenerateWeek(activeDietType)}
                isRegeneratingPlan={isRegeneratingPlan}
                energyUnitPreference={user.energyUnitPreference}
              />
            ) : null}

            {activeView === "diet" ? (
              <DietView
                plans={dietPlans}
                selectedDay={selectedDietDay}
                onSelectDay={setSelectedDietDay}
                selectedDietType={selectedDietType}
                onSelectDietType={setSelectedDietType}
                onToggleMeal={toggleMeal}
                onOpenRecipe={(entry) => setRecipePreview({
                  title: entry.object,
                  description: entry.description,
                  instructions: entry.instructions ?? [],
                  preparationTimeMinutes: entry.preparationTimeMinutes,
                })}
                weekDays={weekDays}
                weekProgress={weekProgress}
                pendingMealKey={pendingMealKey}
                energyUnitPreference={user.energyUnitPreference}
                onGenerateMissingDietType={generateMissingDietMode}
                generationStatus={dietGenerationStatus}
              />
            ) : null}

            {activeView === "workout" ? (
              <WorkoutView
                plan={workoutPlan}
                selectedDay={selectedWorkoutDay}
                onSelectDay={setSelectedWorkoutDay}
                onToggleWorkout={toggleWorkout}
                onRegenerateWorkout={() => regenerateWorkoutPlan()}
                weekDays={weekDays}
                weekProgress={weekProgress}
                pendingWorkoutDay={pendingWorkoutDay}
                energyUnitPreference={user.energyUnitPreference}
                generationStatus={workoutGenerationStatus}
              />
            ) : null}

            {activeView === "shopping" ? (
              <ShoppingView
                shoppingLists={shoppingLists}
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
  shoppingList: ShoppingList | null;
  onGenerate: () => void;
  isRegeneratingPlan: boolean;
  energyUnitPreference: EnergyUnit;
}) {
  const {
    user,
    todayProgress,
    weekDays,
    weekProgress,
    shoppingList,
    energyUnitPreference,
  } = props;
  const consumed = todayProgress?.totals.kilojoulesConsumed ?? 0;
  const burned = todayProgress?.totals.kilojoulesBurned ?? 0;
  const target = user.kilojoulesTarget ?? 0;
  const net = todayProgress?.totals.netKilojoules ?? 0;
  const delta = todayProgress?.totals.kilojouleDeltaFromTarget ?? 0;

  return (
    <div className="view-grid">
      <section className="panel span-2">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Today</span>
            <h3>{humanDate(todayKey())}</h3>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={props.onGenerate}
            disabled={props.isRegeneratingPlan}
          >
            <RefreshCcw02 className="button-icon" />
            {props.isRegeneratingPlan ? "Refreshing plan..." : "Refresh week"}
          </button>
        </div>
        <div className="stats-grid">
          <MetricCard title="Consumed" value={formatEnergyValue(consumed, energyUnitPreference)} detail={`${progressPercent(consumed, target).toFixed(0)}% of target`} />
          <MetricCard title="Burned" value={formatEnergyValue(burned, energyUnitPreference)} detail={formatEnergyValue(todayProgress?.totals.kilojoulesBurned ?? 0, "kj")} />
          <MetricCard title="Net" value={formatEnergyValue(net, energyUnitPreference)} detail={`${formatEnergyValue(delta, energyUnitPreference)} vs target`} />
          <MetricCard
            title="Market plan"
            value={`${shoppingList?.metadata.totalItems ?? 0} items`}
            detail={shoppingList?.metadata.recommendedStore
              ? `${shoppingList.metadata.recommendedStore} looks cheapest`
              : `${shoppingList?.metadata.daysCovered ?? 0} day coverage`}
          />
        </div>

        <div className="progress-rail">
          <div className="progress-copy">
            <strong>Energy pace</strong>
            <span>Consumed versus target</span>
          </div>
          <div className="bar-shell">
            <span className="bar-fill" style={{ width: `${progressPercent(consumed, target)}%` }} />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Week pulse</span>
            <h3>This week</h3>
          </div>
        </div>
        <div className="mini-list">
          {weekDays.map((weekDay) => {
            const progress = weekProgress[weekDay.date];
            return (
              <div key={weekDay.date} className="mini-row">
                <div>
                  <strong>{weekDay.shortLabel}</strong>
                  <span>{humanDate(weekDay.date)}</span>
                </div>
                <div className="mini-row-values">
                  <span>{progress?.totals.mealsCompleted ?? 0}/6 meals</span>
                  <span>{progress?.workout.completed ? "Workout done" : "Workout open"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel span-full">
        <BodyCompositionChart
          user={user}
          weekDays={weekDays}
          weekProgress={weekProgress}
          energyUnitPreference={energyUnitPreference}
        />
      </section>
    </div>
  );
}

function BodyCompositionChart(props: {
  user: UserProfile;
  weekDays: WeekDay[];
  weekProgress: Record<string, ProgressDay>;
  energyUnitPreference: EnergyUnit;
}) {
  const chartWidth = 640;
  const chartHeight = 240;
  const paddingX = 28;
  const paddingTop = 20;
  const paddingBottom = 38;
  const usableHeight = chartHeight - paddingTop - paddingBottom;
  const usableWidth = chartWidth - (paddingX * 2);
  const target = Math.max(props.user.kilojoulesTarget, 1);

  const points = props.weekDays.map((weekDay, index) => {
    const progress = props.weekProgress[weekDay.date];
    const netKilojoules = progress?.totals.netKilojoules ?? 0;
    const burnedKilojoules = progress?.totals.kilojoulesBurned ?? 0;
    const mealsCompleted = progress?.totals.mealsCompleted ?? 0;
    const workoutCompleted = progress?.workout.completed ?? false;
    const intakeRatio = netKilojoules / target;
    const deficitRatio = Math.max(0, (target - netKilojoules) / target);
    const muscleGrowth = Math.max(
      0,
      Math.min(100, (intakeRatio * 42) + (mealsCompleted * 5) + (workoutCompleted ? 26 : 8)),
    );
    const fatBurn = Math.max(
      0,
      Math.min(100, (deficitRatio * 72) + (burnedKilojoules > 0 ? 16 : 0) + (workoutCompleted ? 10 : 0)),
    );

    return {
      label: weekDay.shortLabel,
      x: paddingX + ((usableWidth / Math.max(props.weekDays.length - 1, 1)) * index),
      muscleGrowth,
      fatBurn,
      netKilojoules,
    };
  });

  const resolveY = (value: number): number => (
    paddingTop + ((100 - value) / 100) * usableHeight
  );

  const musclePath = points.map((point) => `${point.x},${resolveY(point.muscleGrowth)}`).join(" ");
  const fatPath = points.map((point) => `${point.x},${resolveY(point.fatBurn)}`).join(" ");
  const averageNet = points.length > 0
    ? Math.round(points.reduce((sum, point) => sum + point.netKilojoules, 0) / points.length)
    : 0;
  const averageMuscle = points.length > 0
    ? Math.round(points.reduce((sum, point) => sum + point.muscleGrowth, 0) / points.length)
    : 0;
  const averageFat = points.length > 0
    ? Math.round(points.reduce((sum, point) => sum + point.fatBurn, 0) / points.length)
    : 0;

  return (
    <>
      <div className="panel-header">
        <div>
          <span className="eyebrow">Body composition trend</span>
          <h3>Muscle growth vs fat burn</h3>
          <p className="muted-line">
            Estimation based on weekly energy balance and completed workouts.
          </p>
        </div>
      </div>

      <div className="chart-legend">
        <span className="chart-legend-item muscle">Muscle growth</span>
        <span className="chart-legend-item fat">Fat burn</span>
      </div>

      <div className="body-chart-shell">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="body-chart" role="img" aria-label="Estimated muscle growth versus fat burn trend">
          {[0, 25, 50, 75, 100].map((value) => (
            <g key={value}>
              <line
                x1={paddingX}
                y1={resolveY(value)}
                x2={chartWidth - paddingX}
                y2={resolveY(value)}
                className="body-chart-grid"
              />
              <text x={6} y={resolveY(value) + 4} className="body-chart-axis">{value}</text>
            </g>
          ))}

          <polyline points={fatPath} className="body-chart-line fat" />
          <polyline points={musclePath} className="body-chart-line muscle" />

          {points.map((point) => (
            <g key={point.label}>
              <circle cx={point.x} cy={resolveY(point.fatBurn)} r={4} className="body-chart-dot fat" />
              <circle cx={point.x} cy={resolveY(point.muscleGrowth)} r={4} className="body-chart-dot muscle" />
              <text x={point.x} y={chartHeight - 10} textAnchor="middle" className="body-chart-axis">{point.label}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="stats-grid composition-stats">
        <MetricCard title="Avg muscle" value={`${averageMuscle}%`} detail="Estimated weekly signal" />
        <MetricCard title="Avg fat burn" value={`${averageFat}%`} detail="Estimated weekly signal" />
        <MetricCard title="Avg net energy" value={formatEnergyValue(averageNet, props.energyUnitPreference)} detail="Across this week" />
      </div>
    </>
  );
}

function DietView(props: {
  plans: Record<DietType, DietPlan | null>;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  selectedDietType: DietType;
  onSelectDietType: (dietType: DietType) => void;
  onToggleMeal: (
    day: DietPlanDay,
    mealSlot: MealSlot,
    completed: boolean,
    dietType: DietType,
  ) => Promise<void>;
  onOpenRecipe: (entry: DietPlanEntry) => void;
  weekDays: WeekDay[];
  weekProgress: Record<string, ProgressDay>;
  pendingMealKey: string | null;
  energyUnitPreference: EnergyUnit;
  onGenerateMissingDietType: (dietType: DietType) => Promise<void>;
  generationStatus: SectionGenerationStatus | null;
}) {
  const plan = props.plans[props.selectedDietType];
  const isGeneratingDiet = props.generationStatus !== null;

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

  return (
    <div className="stack-page">
      <section className="panel">
        <div className="panel-header split-end">
          <div>
            <span className="eyebrow">7-day diet</span>
            <h3>{formatEnergyValue(Math.round(plan.summary.dailyCalories * kilojoulesPerCalorie), props.energyUnitPreference)} target</h3>
            <p className="muted-line">
              {props.selectedDietType === "recipes" ? "Recipe mode" : "Simple meals mode"} · Protein {plan.summary.macros.protein} · Carbs {plan.summary.macros.carbs} · Fats {plan.summary.macros.fats}
            </p>
          </div>
          <div className="panel-header-aside">
            {props.generationStatus ? (
              <SectionGenerationCard kind="diet" status={props.generationStatus} />
            ) : null}
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
      </section>

      <section className="meals-grid">
        {mealConfig.map((meal) => {
          const entries = meal.slot === "supplements"
            ? activeDay.supplements
            : [(activeDay[meal.slot] as DietPlanEntry)];
          const done = activeDay.eatenMeals?.[meal.slot] ?? false;
          const currentMealKey = `${activeDate}:${meal.slot}`;
          const primaryEntry = entries[0];
          const cardTitle = primaryEntry?.object ?? "Open slot";

          return (
            <article key={meal.slot} className="panel meal-card">
              <div className="panel-header split-end">
                <div>
                  <span className="eyebrow">{meal.title}</span>
                  <h3>{cardTitle}</h3>
                </div>
                <button
                  type="button"
                  className={done ? "check-button active" : "check-button"}
                  onClick={() => props.onToggleMeal(activeDay, meal.slot, !done, props.selectedDietType)}
                  disabled={props.pendingMealKey === currentMealKey}
                >
                  {props.pendingMealKey === currentMealKey ? "Saving..." : done ? "Eaten" : "Mark eaten"}
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
    </div>
  );
}

function WorkoutView(props: {
  plan: WorkoutPlan | null;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  onToggleWorkout: (day: WorkoutPlanDay, completed: boolean) => Promise<void>;
  onRegenerateWorkout: () => void;
  weekDays: WeekDay[];
  weekProgress: Record<string, ProgressDay>;
  pendingWorkoutDay: number | null;
  energyUnitPreference: EnergyUnit;
  generationStatus: SectionGenerationStatus | null;
}) {
  if (!props.plan) {
    return (
      <EmptyState
        title="No workout week yet"
        body="Generate a workout-only block to unlock weekly sessions, burn estimates, and workout check-offs."
        actionLabel={props.generationStatus ? "Updating workout..." : "Build workout"}
        onAction={props.onRegenerateWorkout}
        actionDisabled={props.generationStatus !== null}
      >
        {props.generationStatus ? (
          <SectionGenerationCard kind="workout" status={props.generationStatus} />
        ) : null}
      </EmptyState>
    );
  }

  const activeDay = props.plan.days.find((day) => day.day === props.selectedDay) ?? props.plan.days[0];
  const progress = props.weekProgress[props.weekDays.find((day) => day.dayNumber === activeDay.day)?.date ?? todayKey()];

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
            className={progress?.workout.completed ? "check-button active" : "check-button"}
            onClick={() => props.onToggleWorkout(activeDay, !(progress?.workout.completed ?? false))}
            disabled={props.pendingWorkoutDay === activeDay.day}
          >
            {props.pendingWorkoutDay === activeDay.day
              ? "Saving..."
              : progress?.workout.completed ? "Completed" : "Mark complete"}
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
            {activeDay.exercises.map((exercise) => (
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
              </article>
            ))}
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

  if (!shoppingList) {
    return (
      <EmptyState
        title={`No ${props.selectedWeek === "next" ? "next-week" : "current-week"} ${props.selectedDietType === "recipes" ? "recipe" : "single-food"} market list yet`}
        body="That market table has not been generated yet. Current and next-week lists are stored separately for each diet mode."
      />
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
              {profileOptions.diets.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
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
