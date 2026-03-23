import {
  FormEvent,
  ReactNode,
  useRef,
  startTransition,
  useEffect,
  useState,
} from "react";
import { api, ApiError } from "./api";
import { dietTypeOptions, mealConfig, profileOptions, storageKey, viewLabels } from "./constants";
import { formatNumber, getCurrentWeek, humanDate, todayKey } from "./date";
import type {
  AuthAccount,
  AuthSession,
  CompletePlanResult,
  DietPlan,
  DietPlanDay,
  DietPlanEntry,
  DietType,
  MealSlot,
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
  favorieteCoucineRecipes: "",
};

const splitList = (value: string): string[] => value
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

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
  numberOfMeals: Number(draft.numberOfMeals),
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

function App() {
  const defaultSelectedDay = getCurrentWeek().find((day) => day.date === todayKey())?.dayNumber ?? 1;
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [authAccount, setAuthAccount] = useState<AuthAccount | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
  const [todayProgress, setTodayProgress] = useState<ProgressDay | null>(null);
  const [monthSummary, setMonthSummary] = useState<ProgressSummary | null>(null);
  const [yearSummary, setYearSummary] = useState<ProgressSummary | null>(null);
  const [weekProgress, setWeekProgress] = useState<Record<string, ProgressDay>>({});
  const [selectedDietDay, setSelectedDietDay] = useState(defaultSelectedDay);
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState(defaultSelectedDay);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(emptyDraft);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("Checking your session...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
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

  const weekDays = getCurrentWeek();
  const today = todayKey();
  const weekByNumber = dayDateMap(weekDays);
  const profileComplete = user ? isProfileReady(user) : false;

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

  function clearSession(message?: string) {
    window.localStorage.removeItem(storageKey);
    api.clearAccessToken();
    setSessionUserId(null);
    setAuthAccount(null);
    setSessionExpiresAt(null);
    setUser(null);
    setDietPlan(null);
    setWorkoutPlan(null);
    setShoppingList(null);
    setTodayProgress(null);
    setMonthSummary(null);
    setYearSummary(null);
    setWeekProgress({});
    setProfileDraft(emptyDraft);
    setActiveView("dashboard");
    setRecipePreview(null);
    setPendingMealKey(null);
    setPendingWorkoutDay(null);
    setPendingShoppingItemId(null);
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
      const [freshDiet, freshWorkout, freshShopping, freshToday, freshMonth, freshYear] = await Promise.all([
        api.getDietPlan(userId),
        api.getWorkoutPlan(userId),
        api.getShoppingList(userId),
        api.getProgressDay(userId, today),
        api.getProgressSummary(userId, "month", today),
        api.getProgressSummary(userId, "year", today),
      ]);

      const progressDays = await Promise.all(
        weekDays.map(async (weekDay) => {
          const progressDay = await api.getProgressDay(userId, weekDay.date);
          return [weekDay.date, progressDay] as const;
        }),
      );

      startTransition(() => {
        setSessionUserId(userId);
        setAuthAccount(nextAccount);
        setSessionExpiresAt(nextExpiresAt);
        setUser(freshUser);
        setProfileDraft(toDraft(freshUser));
        setDietPlan(freshDiet);
        setWorkoutPlan(freshWorkout);
        setShoppingList(freshShopping);
        setTodayProgress(freshToday);
        setMonthSummary(freshMonth);
        setYearSummary(freshYear);
        setWeekProgress(Object.fromEntries(progressDays));
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

    startTransition(() => {
      setTodayProgress(freshToday);
      setMonthSummary(freshMonth);
      setYearSummary(freshYear);
      setWeekProgress(Object.fromEntries(progressDays));
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

  async function saveProfile(options?: { regenerate?: boolean; dietType?: DietType }) {
    if (!sessionUserId) {
      return;
    }

    setBusyAction(options?.regenerate ? "generate" : "save");
    setErrorMessage(null);

    try {
      await api.saveUser(sessionUserId, buildSavePayload({
        ...profileDraft,
        kindOfDiet: options?.dietType ?? profileDraft.kindOfDiet,
      }));

      const refreshedUser = await api.getUser(sessionUserId);
      setUser(refreshedUser);
      setProfileDraft(toDraft(refreshedUser));

      if (options?.regenerate) {
        const generated = await api.generateCompletePlan(
          sessionUserId,
          options.dietType ?? (refreshedUser.kindOfDiet === "recipes" ? "recipes" : "single-food"),
        );
        hydrateGeneratedPlans(generated);
      }

      await loadWorkspace(sessionUserId, "Studio refreshed.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save your profile");
    } finally {
      setBusyAction(null);
    }
  }

  function hydrateGeneratedPlans(result: CompletePlanResult) {
    if (result.dietPlan) {
      setDietPlan(result.dietPlan);
    }

    if (result.workoutPlan) {
      setWorkoutPlan(result.workoutPlan);
    }

    if (result.shoppingList) {
      setShoppingList(result.shoppingList);
    }
  }

  async function regenerateWeek(dietType: DietType) {
    if (!sessionUserId) {
      return;
    }

    setBusyAction("generate");
    setErrorMessage(null);

    try {
      const result = await api.generateCompletePlan(sessionUserId, dietType);
      hydrateGeneratedPlans(result);
      await loadWorkspace(sessionUserId, "Week rebuilt.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to rebuild plan");
      setBusyAction(null);
    }
  }

  async function toggleMeal(day: DietPlanDay, mealSlot: MealSlot, completed: boolean) {
    if (!sessionUserId) {
      return;
    }

    const mappedDate = weekByNumber[day.day];
    const mealKey = `${mappedDate}:${mealSlot}`;
    setPendingMealKey(mealKey);

    mealActionQueueRef.current = mealActionQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const result = await api.toggleMeal(sessionUserId, mealSlot, mappedDate, completed);
        setWeekProgress((current) => ({ ...current, [mappedDate]: result }));

        if (mappedDate === today) {
          setTodayProgress(result);
        }

        await refreshProgress(sessionUserId);
      })
      .catch((error) => {
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
      const result = await api.toggleShoppingItem(sessionUserId, item.id, checked);
      setShoppingList(result);
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
        <div className="loading-orb" />
        <p>{statusMessage}</p>
      </div>
    );
  }

  if (!sessionUserId || !user) {
    return (
      <div className="auth-layout">
        <section className="auth-hero">
          <div className="eyebrow">AI Shape Studio</div>
          <h1>Build a week that feels coached, not generic.</h1>
          <p>
            Start with your body data, your food style, and the time you actually have.
            The app maps your diet, training, market list, and daily progress in one place.
          </p>
          <div className="hero-google-entry">
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
            <article>
              <strong>Session-based access</strong>
              <span>Email/password or Google sign-in, with expiring sessions instead of raw user IDs.</span>
            </article>
            <article>
              <strong>Flexible diet mode</strong>
              <span>Switch between single foods and recipes without leaving the workspace.</span>
            </article>
            <article>
              <strong>Weekly market list</strong>
              <span>See grams for foods, milliliters for liquids, AU store estimates, and persistent check-offs.</span>
            </article>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
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

          <div className="auth-card subtle">
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="eyebrow">AI Shape</span>
          <h1>{user.name || "New member"}</h1>
          <p>{user.goal ? titleCase(user.goal) : "Finish your assessment to unlock your week."}</p>
        </div>

        <nav className="sidebar-nav">
          {(Object.keys(viewLabels) as ViewKey[]).map((view) => (
            <button
              key={view}
              type="button"
              className={activeView === view ? "nav-pill active" : "nav-pill"}
              onClick={() => startTransition(() => setActiveView(view))}
            >
              {viewLabels[view]}
            </button>
          ))}
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
              <span>Diet Mode</span>
              <strong>{user.kindOfDiet === "recipes" ? "Recipes" : "Single foods"}</strong>
            </article>
            <article>
              <span>Daily Target</span>
              <strong>{formatNumber(user.caloriesTarget)} kcal</strong>
            </article>
            <article>
              <span>Week Coverage</span>
              <strong>{dietPlan?.days.length ?? 0}/7 days</strong>
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
          />
        ) : (
          <>
            {activeView === "dashboard" ? (
              <DashboardView
                user={user}
                todayProgress={todayProgress}
                monthSummary={monthSummary}
                yearSummary={yearSummary}
                weekDays={weekDays}
                weekProgress={weekProgress}
                shoppingList={shoppingList}
                onGenerate={() => regenerateWeek((user.kindOfDiet === "recipes" ? "recipes" : "single-food"))}
                busyAction={busyAction}
              />
            ) : null}

            {activeView === "diet" ? (
              <DietView
                plan={dietPlan}
                selectedDay={selectedDietDay}
                onSelectDay={setSelectedDietDay}
                onToggleMeal={toggleMeal}
                onOpenRecipe={(entry) => setRecipePreview({
                  title: entry.object,
                  description: entry.description,
                  instructions: entry.instructions ?? [],
                  preparationTimeMinutes: entry.preparationTimeMinutes,
                })}
                onRegenerate={regenerateWeek}
                currentDietType={(user.kindOfDiet === "recipes" ? "recipes" : "single-food")}
                weekDays={weekDays}
                weekProgress={weekProgress}
                isRegenerating={busyAction === "generate"}
                pendingMealKey={pendingMealKey}
              />
            ) : null}

            {activeView === "workout" ? (
              <WorkoutView
                plan={workoutPlan}
                selectedDay={selectedWorkoutDay}
                onSelectDay={setSelectedWorkoutDay}
                onToggleWorkout={toggleWorkout}
                weekDays={weekDays}
                weekProgress={weekProgress}
                pendingWorkoutDay={pendingWorkoutDay}
              />
            ) : null}

            {activeView === "shopping" ? (
              <ShoppingView
                shoppingList={shoppingList}
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
  );
}

function DashboardView(props: {
  user: UserProfile;
  todayProgress: ProgressDay | null;
  monthSummary: ProgressSummary | null;
  yearSummary: ProgressSummary | null;
  weekDays: WeekDay[];
  weekProgress: Record<string, ProgressDay>;
  shoppingList: ShoppingList | null;
  onGenerate: () => void;
  busyAction: string | null;
}) {
  const { user, todayProgress, monthSummary, yearSummary, weekDays, weekProgress, shoppingList } = props;
  const consumed = todayProgress?.totals.caloriesConsumed ?? 0;
  const burned = todayProgress?.totals.caloriesBurned ?? 0;
  const target = user.caloriesTarget ?? 0;
  const net = todayProgress?.totals.netCalories ?? 0;

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
            disabled={props.busyAction === "generate"}
          >
            {props.busyAction === "generate" ? "Refreshing week..." : "Refresh week"}
          </button>
        </div>
        <div className="stats-grid">
          <MetricCard title="Consumed" value={`${formatNumber(consumed)} kcal`} detail={`${progressPercent(consumed, target).toFixed(0)}% of target`} />
          <MetricCard title="Burned" value={`${formatNumber(burned)} kcal`} detail={`${formatNumber(todayProgress?.totals.kilojoulesBurned ?? 0)} kJ`} />
          <MetricCard title="Net" value={`${formatNumber(net)} kcal`} detail={`${formatNumber(todayProgress?.totals.calorieDeltaFromTarget ?? 0)} vs target`} />
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
            <strong>Calorie pace</strong>
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

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Month</span>
            <h3>Current month</h3>
          </div>
        </div>
        <SummaryCard summary={monthSummary} />
      </section>

      <section className="panel span-2">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Year</span>
            <h3>Longer view</h3>
          </div>
        </div>
        <SummaryCard summary={yearSummary} wide />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Coach note</span>
            <h3>Focus today</h3>
          </div>
        </div>
        <p className="coach-note">
          Keep the workflow simple: eat through your planned meals, mark them as you go, and use
          the workout check-off when the session is complete. The dashboard recalculates your day
          immediately.
        </p>
      </section>
    </div>
  );
}

function DietView(props: {
  plan: DietPlan | null;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  onToggleMeal: (day: DietPlanDay, mealSlot: MealSlot, completed: boolean) => Promise<void>;
  onOpenRecipe: (entry: DietPlanEntry) => void;
  onRegenerate: (dietType: DietType) => Promise<void>;
  currentDietType: DietType;
  weekDays: WeekDay[];
  weekProgress: Record<string, ProgressDay>;
  isRegenerating: boolean;
  pendingMealKey: string | null;
}) {
  if (!props.plan) {
    return (
      <EmptyState
        title="No weekly diet yet"
        body="Generate your 7-day diet to unlock meal cards, grams, macros, and meal check-offs."
      />
    );
  }

  const activeDay = props.plan.days.find((day) => day.day === props.selectedDay) ?? props.plan.days[0];
  const activeDate = props.weekDays.find((item) => item.dayNumber === activeDay.day)?.date ?? todayKey();
  const activeProgress = props.weekProgress[activeDate];

  return (
    <div className="stack-page">
      <section className="panel">
        <div className="panel-header split-end">
          <div>
            <span className="eyebrow">7-day diet</span>
            <h3>{formatNumber(props.plan.summary.dailyCalories)} kcal target</h3>
            <p className="muted-line">
              Protein {props.plan.summary.macros.protein} · Carbs {props.plan.summary.macros.carbs} · Fats {props.plan.summary.macros.fats}
            </p>
          </div>

          <div className="inline-actions">
            {dietTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === props.currentDietType ? "toggle active" : "toggle"}
                onClick={() => props.onRegenerate(option.value)}
                disabled={props.isRegenerating}
              >
                {option.label}
              </button>
            ))}
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
          const progress = activeProgress?.meals[meal.slot];
          const done = progress?.completed ?? false;
          const currentMealKey = `${activeDate}:${meal.slot}`;

          return (
            <article key={meal.slot} className="panel meal-card">
              <div className="panel-header split-end">
                <div>
                  <span className="eyebrow">{meal.title}</span>
                  <h3>{entries[0]?.object || "Open slot"}</h3>
                </div>
                <button
                  type="button"
                  className={done ? "check-button active" : "check-button"}
                  onClick={() => props.onToggleMeal(activeDay, meal.slot, !done)}
                  disabled={props.pendingMealKey === currentMealKey}
                >
                  {props.pendingMealKey === currentMealKey ? "Saving..." : done ? "Eaten" : "Mark eaten"}
                </button>
              </div>

              {entries.map((entry, index) => (
                <div key={`${meal.slot}-${index}`} className="entry-block">
                  <p className="entry-description">{entry.description}</p>
                  {entry.instructions?.length ? (
                    <button
                      type="button"
                      className="recipe-button"
                      onClick={() => props.onOpenRecipe(entry)}
                    >
                      Open recipe
                    </button>
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
  weekDays: WeekDay[];
  weekProgress: Record<string, ProgressDay>;
  pendingWorkoutDay: number | null;
}) {
  if (!props.plan) {
    return (
      <EmptyState
        title="No workout week yet"
        body="Generate a full plan to unlock weekly sessions, burn estimates, and workout check-offs."
      />
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
              {props.plan.overview.avgDuration} average · {formatNumber(props.plan.overview.estimatedWeeklyCaloriesBurned ?? 0)} kcal weekly burn
            </p>
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
              <span>{formatNumber(day.estimatedCaloriesBurned ?? 0)} kcal</span>
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
              {activeDay.totalDuration} · {formatNumber(activeDay.estimatedCaloriesBurned ?? 0)} kcal burn
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
  shoppingList: ShoppingList | null;
  onToggleItem: (item: ShoppingItem, checked: boolean) => Promise<void>;
  pendingItemId: string | null;
}) {
  if (!props.shoppingList) {
    return (
      <EmptyState
        title="No weekly market list yet"
        body="Generate the complete plan to save a 7-day market list with grams for food and milliliters for liquids."
      />
    );
  }

  const entries = Object.entries(props.shoppingList.categories);

  return (
    <div className="view-grid">
      <section className="panel span-2">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Weekly market list</span>
            <h3>{props.shoppingList.metadata.totalItems} items for {props.shoppingList.metadata.daysCovered ?? 7} days</h3>
          </div>
        </div>
        <div className="stats-grid">
          <MetricCard
            title="Estimated cost"
            value={`$${props.shoppingList.metadata.estimatedCost} ${props.shoppingList.metadata.currency ?? "AUD"}`}
            detail={props.shoppingList.metadata.recommendedStore
              ? `${props.shoppingList.metadata.recommendedStore} looks cheapest`
              : "AI estimate"}
          />
          <MetricCard title="Store sections" value={String(props.shoppingList.metadata.storeSections)} detail={props.shoppingList.metadata.prepTime} />
          <MetricCard title="Batch items" value={String(props.shoppingList.mealPrepStrategy.batchCookItems.length)} detail={firstOrEmpty(props.shoppingList.mealPrepStrategy.batchCookItems)} />
          <MetricCard title="Pantry staples" value={String(props.shoppingList.pantryChecklist.length)} detail={firstOrEmpty(props.shoppingList.pantryChecklist)} />
        </div>
        {props.shoppingList.metadata.estimatedCostAudByStore ? (
          <div className="store-price-grid">
            <MetricCard title="Coles" value={`$${props.shoppingList.metadata.estimatedCostAudByStore.coles}`} detail="Estimated basket" />
            <MetricCard title="Woolworths" value={`$${props.shoppingList.metadata.estimatedCostAudByStore.woolworths}`} detail="Estimated basket" />
            <MetricCard title="Aldi" value={`$${props.shoppingList.metadata.estimatedCostAudByStore.aldi}`} detail="Estimated basket" />
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
          {props.shoppingList.byStoreSection.map((section) => (
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
          <Field label="Meals per day">
            <input type="number" value={draft.numberOfMeals} onChange={(event) => updateField("numberOfMeals", event.target.value)} placeholder="4" />
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
            {props.busyAction === "save" ? "Saving..." : "Save only"}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={props.onSaveAndGenerate}
            disabled={props.busyAction === "generate"}
          >
            {props.busyAction === "generate" ? "Building your week..." : "Save and build week"}
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

function SummaryCard(props: { summary: ProgressSummary | null; wide?: boolean }) {
  if (!props.summary || props.summary.totals.trackedDays === 0) {
    return <p className="empty-line">No tracked entries yet.</p>;
  }

  return (
    <div className={props.wide ? "summary-card wide" : "summary-card"}>
      <div className="stats-grid summary-stats">
        <MetricCard title="Tracked days" value={String(props.summary.totals.trackedDays)} detail={props.summary.period} />
        <MetricCard title="Consumed" value={`${formatNumber(props.summary.totals.caloriesConsumed)} kcal`} detail={`${formatNumber(props.summary.totals.kilojoulesConsumed)} kJ`} />
        <MetricCard title="Burned" value={`${formatNumber(props.summary.totals.caloriesBurned)} kcal`} detail={`${formatNumber(props.summary.totals.kilojoulesBurned)} kJ`} />
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
              <span>{formatNumber(row.caloriesConsumed)} in</span>
              <span>{formatNumber(row.caloriesBurned)} out</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState(props: { title: string; body: string }) {
  return (
    <section className="panel empty-state">
      <span className="eyebrow">Nothing saved yet</span>
      <h3>{props.title}</h3>
      <p>{props.body}</p>
    </section>
  );
}

export default App;
