import { NotFoundError, ValidationError } from "../../../share/Errors/AppErrors";
import { RepositoryUser } from "../../../user/repositories/RepositoryUser";
import { WaterRequirementService } from "../../../diet/handlers/services/WaterRequirementService";
import { TrackMealProgressCommand } from "../../command/TrackMealProgressCommand";
import { TrackWorkoutProgressCommand } from "../../command/TrackWorkoutProgressCommand";
import { TrackWaterProgressCommand } from "../../command/TrackWaterProgressCommand";
import { GetUserExerciseLogsQuery } from "../../queries/GetUserExerciseLogsQuery";
import { GetUserProgressDayQuery } from "../../queries/GetUserProgressDayQuery";
import { GetUserProgressSummaryQuery } from "../../queries/GetUserProgressSummaryQuery";
import { GetUserTrackingEntriesQuery } from "../../queries/GetUserTrackingEntriesQuery";
import { GetUserWaterEntriesQuery } from "../../queries/GetUserWaterEntriesQuery";
import {
  DataUserCommand,
  DietPlan,
  DietPlanDay,
  DietPlanEntry,
  MacroSnapshot,
  TrackableMealSlot,
  UserExerciseLog,
  UserExerciseLogInput,
  UserProgressBreakdownItem,
  UserProgressDay,
  UserProgressMealStatus,
  UserProgressPeriod,
  UserProgressSummary,
  UserProgressTotals,
  UserTrackingEntry,
  UserWaterEntry,
  WorkoutPlan,
  WorkoutPlanDay,
} from "../../../../src/types";

const weekdayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const kilojoulesPerCalorie = 4.184;

const createEmptyMealStatus = (): UserProgressMealStatus => ({
  completed: false,
  completedAt: null,
  calories: 0,
  kilojoules: 0,
  proteinGrams: 0,
  carbsGrams: 0,
  fatsGrams: 0,
});

const createEmptyTotals = (): UserProgressTotals => ({
  caloriesConsumed: 0,
  kilojoulesConsumed: 0,
  caloriesBurned: 0,
  kilojoulesBurned: 0,
  netCalories: 0,
  netKilojoules: 0,
  calorieDeltaFromTarget: 0,
  kilojouleDeltaFromTarget: 0,
  mealsCompleted: 0,
  workoutsCompleted: 0,
});

const createEmptyMacroTotals = (): UserProgressDay["macroTotals"] => ({
  proteinGrams: 0,
  carbsGrams: 0,
  fatsGrams: 0,
});

const cloneMacroTotals = (snapshot: MacroSnapshot): MacroSnapshot => ({
  proteinGrams: snapshot.proteinGrams,
  carbsGrams: snapshot.carbsGrams,
  fatsGrams: snapshot.fatsGrams,
});

const toCaloriesFromKilojoules = (kilojoules: number): number => (
  Math.round(kilojoules / kilojoulesPerCalorie)
);

const parseMacroGrams = (value: string | undefined): number => {
  if (typeof value !== "string") {
    return 0;
  }

  const match = value.trim().match(/-?\d+(\.\d+)?/);
  return match ? Math.round(Number(match[0])) : 0;
};

const normaliseDate = (value: string): string => {
  if (!isoDatePattern.test(value)) {
    throw new ValidationError(`"${value}" must be a valid date in YYYY-MM-DD format.`);
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    throw new ValidationError(`"${value}" must be a valid calendar date.`);
  }

  return value;
};

const assertDateRange = (startDate: string, endDate: string): void => {
  if (startDate > endDate) {
    throw new ValidationError("\"startDate\" must be before or equal to \"endDate\".");
  }
};

const getLocalDateKey = (value = new Date()): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const assertNotFutureDate = (date: string): void => {
  if (date > getLocalDateKey()) {
    throw new ValidationError("Future meals and workouts stay locked until that date is active.");
  }
};

const getPlanDayNumber = (date: string): number => {
  const [yearText, monthText, dayText] = date.split("-");
  const value = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  const weekday = value.getUTCDay();

  return weekday === 0 ? 7 : weekday;
};

const getPlanDayName = (date: string): string => weekdayNames[getPlanDayNumber(date) - 1];

const getLastDayOfMonth = (year: number, month: number): number => (
  new Date(Date.UTC(year, month, 0)).getUTCDate()
);

const shiftDate = (date: string, offsetDays: number): string => {
  const [yearText, monthText, dayText] = date.split("-");
  const value = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  value.setUTCDate(value.getUTCDate() + offsetDays);

  return value.toISOString().slice(0, 10);
};

const buildDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = shiftDate(cursor, 1);
  }

  return dates;
};

const resolvePeriodRange = (
  period: UserProgressPeriod,
  date: string,
): { rangeStart: string; rangeEnd: string } => {
  const [yearText, monthText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (period === "day") {
    return { rangeStart: date, rangeEnd: date };
  }

  if (period === "month") {
    const lastDay = String(getLastDayOfMonth(year, month)).padStart(2, "0");
    return {
      rangeStart: `${yearText}-${monthText}-01`,
      rangeEnd: `${yearText}-${monthText}-${lastDay}`,
    };
  }

  return {
    rangeStart: `${yearText}-01-01`,
    rangeEnd: `${yearText}-12-31`,
  };
};

const createEmptyProgressDay = (
  user: DataUserCommand,
  date: string,
): UserProgressDay => ({
  userId: user.id,
  date,
  planDayNumber: getPlanDayNumber(date),
  planDayName: getPlanDayName(date),
  targets: {
    kilojoules: Math.round(user.kilojoulesTarget),
    calories: toCaloriesFromKilojoules(Math.round(user.kilojoulesTarget)),
  },
  meals: {
    breakfast: createEmptyMealStatus(),
    snack1: createEmptyMealStatus(),
    lunch: createEmptyMealStatus(),
    dinner: createEmptyMealStatus(),
    snack2: createEmptyMealStatus(),
    supplements: createEmptyMealStatus(),
  },
  workout: {
    completed: false,
    completedAt: null,
    caloriesBurned: 0,
    kilojoulesBurned: 0,
  },
  macroTotals: createEmptyMacroTotals(),
  totals: createEmptyTotals(),
});

const sumMealStatus = (
  statuses: UserProgressMealStatus[],
): Pick<UserProgressDay, "macroTotals" | "totals"> => {
  const kilojoulesConsumed = statuses.reduce((sum, status) => sum + status.kilojoules, 0);
  const mealsCompleted = statuses.filter((status) => status.completed).length;
  const proteinGrams = statuses.reduce((sum, status) => sum + status.proteinGrams, 0);
  const carbsGrams = statuses.reduce((sum, status) => sum + status.carbsGrams, 0);
  const fatsGrams = statuses.reduce((sum, status) => sum + status.fatsGrams, 0);

  return {
    macroTotals: {
      proteinGrams,
      carbsGrams,
      fatsGrams,
    },
    totals: {
      ...createEmptyTotals(),
      caloriesConsumed: toCaloriesFromKilojoules(kilojoulesConsumed),
      kilojoulesConsumed,
      mealsCompleted,
    },
  };
};

const recalculateTotals = (progressDay: UserProgressDay): UserProgressDay => {
  const mealSummary = sumMealStatus([
    progressDay.meals.breakfast,
    progressDay.meals.snack1,
    progressDay.meals.lunch,
    progressDay.meals.dinner,
    progressDay.meals.snack2,
    progressDay.meals.supplements,
  ]);
  const kilojoulesBurned = progressDay.workout.kilojoulesBurned;
  const caloriesBurned = toCaloriesFromKilojoules(kilojoulesBurned);
  const netKilojoules = mealSummary.totals.kilojoulesConsumed - kilojoulesBurned;
  const netCalories = toCaloriesFromKilojoules(netKilojoules);
  const kilojouleDeltaFromTarget = netKilojoules - progressDay.targets.kilojoules;

  return {
    ...progressDay,
    macroTotals: mealSummary.macroTotals,
    totals: {
      caloriesConsumed: mealSummary.totals.caloriesConsumed,
      kilojoulesConsumed: mealSummary.totals.kilojoulesConsumed,
      caloriesBurned,
      kilojoulesBurned,
      netCalories,
      netKilojoules,
      calorieDeltaFromTarget: toCaloriesFromKilojoules(kilojouleDeltaFromTarget),
      kilojouleDeltaFromTarget,
      mealsCompleted: mealSummary.totals.mealsCompleted,
      workoutsCompleted: progressDay.workout.completed ? 1 : 0,
    },
  };
};

const toRoundedNumber = (value: number | undefined | null): number => (
  Number.isFinite(value) ? Math.round(value as number) : 0
);

const resolveKilojoules = (
  kilojoules: number | undefined,
  calories: number | undefined,
): number => {
  if (Number.isFinite(kilojoules)) {
    return Math.round(kilojoules as number);
  }

  if (Number.isFinite(calories)) {
    return Math.round((calories as number) * 4.184);
  }

  return 0;
};

const resolveMealStatusFromEntry = (
  entry: DietPlanEntry,
  completed: boolean,
): UserProgressMealStatus => {
  if (!completed) {
    return createEmptyMealStatus();
  }

  return {
    completed: true,
    completedAt: new Date().toISOString(),
    kilojoules: resolveKilojoules(entry.kilojoules, entry.calories),
    calories: toCaloriesFromKilojoules(resolveKilojoules(entry.kilojoules, entry.calories)),
    proteinGrams: parseMacroGrams(entry.macros?.protein),
    carbsGrams: parseMacroGrams(entry.macros?.carbs),
    fatsGrams: parseMacroGrams(entry.macros?.fats),
  };
};

const resolveSupplementsStatus = (
  entries: DietPlanEntry[],
  completed: boolean,
): UserProgressMealStatus => {
  if (!completed) {
    return createEmptyMealStatus();
  }

  const calories = entries.reduce((sum, entry) => sum + toRoundedNumber(entry.calories), 0);
  const kilojoules = entries.reduce(
    (sum, entry) => sum + resolveKilojoules(entry.kilojoules, entry.calories),
    0,
  );
  const proteinGrams = entries.reduce((sum, entry) => sum + parseMacroGrams(entry.macros?.protein), 0);
  const carbsGrams = entries.reduce((sum, entry) => sum + parseMacroGrams(entry.macros?.carbs), 0);
  const fatsGrams = entries.reduce((sum, entry) => sum + parseMacroGrams(entry.macros?.fats), 0);

  return {
    completed: true,
    completedAt: new Date().toISOString(),
    calories: calories > 0 ? calories : toCaloriesFromKilojoules(kilojoules),
    kilojoules,
    proteinGrams,
    carbsGrams,
    fatsGrams,
  };
};

const resolveWorkoutStatus = (
  workoutDay: WorkoutPlanDay,
  completed: boolean,
): UserProgressDay["workout"] => {
  if (!completed) {
    return {
      completed: false,
      completedAt: null,
      caloriesBurned: 0,
      kilojoulesBurned: 0,
    };
  }

  const kilojoulesBurned = resolveKilojoules(
    workoutDay.estimatedKilojoulesBurned,
    workoutDay.estimatedCaloriesBurned,
  );

  return {
    completed: true,
    completedAt: new Date().toISOString(),
    caloriesBurned: toCaloriesFromKilojoules(kilojoulesBurned),
    kilojoulesBurned,
  };
};

const getDietEntries = (dietDay: DietPlanDay): DietPlanEntry[] => ([
  dietDay.breakfast,
  dietDay.snack1,
  dietDay.lunch,
  dietDay.dinner,
  dietDay.snack2,
  ...dietDay.supplements,
]);

const resolveDietTargets = (
  dietDay: DietPlanDay | null,
): Pick<UserTrackingEntry, "kjsTarget" | "macrosTarget"> => {
  if (!dietDay) {
    return {
      kjsTarget: 0,
      macrosTarget: createEmptyMacroTotals(),
    };
  }

  return getDietEntries(dietDay).reduce<Pick<UserTrackingEntry, "kjsTarget" | "macrosTarget">>(
    (current, entry) => ({
      kjsTarget: current.kjsTarget + resolveKilojoules(entry.kilojoules, entry.calories),
      macrosTarget: {
        proteinGrams: current.macrosTarget.proteinGrams + parseMacroGrams(entry.macros?.protein),
        carbsGrams: current.macrosTarget.carbsGrams + parseMacroGrams(entry.macros?.carbs),
        fatsGrams: current.macrosTarget.fatsGrams + parseMacroGrams(entry.macros?.fats),
      },
    }),
    {
      kjsTarget: 0,
      macrosTarget: createEmptyMacroTotals(),
    },
  );
};

const resolveWorkoutTarget = (workoutDay: WorkoutPlanDay | null): number => (
  workoutDay
    ? resolveKilojoules(
      workoutDay.estimatedKilojoulesBurned,
      workoutDay.estimatedCaloriesBurned,
    )
    : 0
);

const parsePlanCount = (value: string | undefined): number => {
  if (typeof value !== "string") {
    return 0;
  }

  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
};

const buildDefaultExerciseLogs = (workoutDay: WorkoutPlanDay): UserExerciseLogInput[] => (
  workoutDay.exercises.map((exercise) => ({
    exerciseName: exercise.name,
    setsCompleted: parsePlanCount(exercise.sets),
    repsCompleted: parsePlanCount(exercise.reps),
    weightUsed: 0,
  }))
);

const findDietPlanDay = (dietPlan: DietPlan, date: string): DietPlanDay | null => {
  const expectedDayNumber = getPlanDayNumber(date);
  const expectedDayName = getPlanDayName(date).toLowerCase();

  return dietPlan.days.find((day) => (
    day.dayName.toLowerCase() === expectedDayName || day.day === expectedDayNumber
  )) ?? null;
};

const findWorkoutPlanDay = (
  workoutPlan: WorkoutPlan,
  date: string,
): WorkoutPlanDay | null => {
  const expectedDayNumber = getPlanDayNumber(date);
  const expectedDayName = getPlanDayName(date).toLowerCase();

  return workoutPlan.days.find((day) => (
    day.dayName.toLowerCase() === expectedDayName || day.day === expectedDayNumber
  )) ?? null;
};

const resolveMealStatus = (
  dietDay: DietPlanDay,
  mealSlot: TrackableMealSlot,
  completed: boolean,
): UserProgressMealStatus => {
  switch (mealSlot) {
    case "breakfast":
      return resolveMealStatusFromEntry(dietDay.breakfast, completed);
    case "snack1":
      return resolveMealStatusFromEntry(dietDay.snack1, completed);
    case "lunch":
      return resolveMealStatusFromEntry(dietDay.lunch, completed);
    case "dinner":
      return resolveMealStatusFromEntry(dietDay.dinner, completed);
    case "snack2":
      return resolveMealStatusFromEntry(dietDay.snack2, completed);
    case "supplements":
      return resolveSupplementsStatus(dietDay.supplements, completed);
    default:
      throw new ValidationError(`Unsupported meal slot "${mealSlot}".`);
  }
};

const sumTotals = (
  currentTotals: UserProgressTotals & { trackedDays: number },
  nextTotals: UserProgressTotals,
): UserProgressTotals & { trackedDays: number } => ({
  caloriesConsumed: currentTotals.caloriesConsumed + nextTotals.caloriesConsumed,
  kilojoulesConsumed: currentTotals.kilojoulesConsumed + nextTotals.kilojoulesConsumed,
  caloriesBurned: currentTotals.caloriesBurned + nextTotals.caloriesBurned,
  kilojoulesBurned: currentTotals.kilojoulesBurned + nextTotals.kilojoulesBurned,
  netCalories: currentTotals.netCalories + nextTotals.netCalories,
  netKilojoules: currentTotals.netKilojoules + nextTotals.netKilojoules,
  calorieDeltaFromTarget: currentTotals.calorieDeltaFromTarget + nextTotals.calorieDeltaFromTarget,
  kilojouleDeltaFromTarget: currentTotals.kilojouleDeltaFromTarget + nextTotals.kilojouleDeltaFromTarget,
  mealsCompleted: currentTotals.mealsCompleted + nextTotals.mealsCompleted,
  workoutsCompleted: currentTotals.workoutsCompleted + nextTotals.workoutsCompleted,
  trackedDays: currentTotals.trackedDays,
});

const buildBreakdown = (
  rows: UserProgressDay[],
  period: UserProgressPeriod,
  referenceDate: string,
): UserProgressBreakdownItem[] => {
  if (period === "day") {
    const day = rows[0];

    if (!day) {
      return [{
        label: referenceDate,
        rangeStart: referenceDate,
        rangeEnd: referenceDate,
        trackedDays: 0,
        ...createEmptyTotals(),
      }];
    }

    return [{
      label: day.date,
      rangeStart: day.date,
      rangeEnd: day.date,
      trackedDays: 1,
      ...day.totals,
    }];
  }

  const grouped = new Map<string, UserProgressBreakdownItem>();

  for (const row of rows) {
    const key = period === "month" ? row.date : row.date.slice(0, 7);

    if (!grouped.has(key)) {
      let rangeStart = key;
      let rangeEnd = key;

      if (period === "month") {
        rangeStart = row.date;
        rangeEnd = row.date;
      } else {
        const [yearText, monthText] = key.split("-");
        const lastDay = String(getLastDayOfMonth(Number(yearText), Number(monthText))).padStart(2, "0");
        rangeStart = `${key}-01`;
        rangeEnd = `${key}-${lastDay}`;
      }

      grouped.set(key, {
        label: key,
        rangeStart,
        rangeEnd,
        trackedDays: 0,
        ...createEmptyTotals(),
      });
    }

    const current = grouped.get(key);

    if (!current) {
      continue;
    }

    const nextTotals = sumTotals(
      { ...current, trackedDays: current.trackedDays },
      row.totals,
    );

    grouped.set(key, {
      ...current,
      ...nextTotals,
      trackedDays: current.trackedDays + 1,
    });
  }

  return Array.from(grouped.values()).sort((left, right) => (
    left.rangeStart.localeCompare(right.rangeStart)
  ));
};

export class UserProgressTrackingService {
  constructor(
    private readonly repositoryUser: RepositoryUser,
    private readonly waterRequirementService = new WaterRequirementService(),
  ) {}

  async trackMeal(command: TrackMealProgressCommand): Promise<UserProgressDay> {
    const date = normaliseDate(command.date);
    assertNotFutureDate(date);
    const user = await this.getUser(command.userId);
    const selectedDietType = command.dietType ?? (
      user.kindOfDiet === "single-food" ? "single-food" : "recipes"
    );
    const dietPlan = await this.repositoryUser.getDietPlan(command.userId, {
      dietType: selectedDietType,
      week: command.week,
    });

    if (!dietPlan) {
      throw new NotFoundError(`Diet plan for user "${command.userId}" was not found.`);
    }

    const dietDay = findDietPlanDay(dietPlan, date);

    if (!dietDay) {
      throw new NotFoundError(`Diet plan day for "${date}" was not found.`);
    }

    const progressDay = await this.getOrCreateProgressDay(user, date);
    const nextDay = recalculateTotals({
      ...progressDay,
      planDayNumber: getPlanDayNumber(date),
      planDayName: getPlanDayName(date),
      targets: {
        kilojoules: Math.round(user.kilojoulesTarget),
        calories: toCaloriesFromKilojoules(Math.round(user.kilojoulesTarget)),
      },
      meals: {
        ...progressDay.meals,
        [command.mealSlot]: resolveMealStatus(dietDay, command.mealSlot, command.completed),
      },
    });

    const savedDay = await this.repositoryUser.saveUserProgressDay(nextDay);
    await this.repositoryUser.syncDietPlanMealEatenState(
      command.userId,
      selectedDietType,
      nextDay.planDayNumber,
      command.mealSlot,
      command.completed,
      command.week,
    );
    await this.syncTrackingEntry({
      user,
      date,
      progressDay: savedDay,
      dietDay,
      workoutDay: await this.getWorkoutDay(command.userId, date),
    });

    return savedDay;
  }

  async trackWorkout(command: TrackWorkoutProgressCommand): Promise<UserProgressDay> {
    const date = normaliseDate(command.date);
    assertNotFutureDate(date);
    const user = await this.getUser(command.userId);
    const workoutPlan = await this.repositoryUser.getWorkoutPlan(command.userId);

    if (!workoutPlan) {
      throw new NotFoundError(`Workout plan for user "${command.userId}" was not found.`);
    }

    const workoutDay = findWorkoutPlanDay(workoutPlan, date);

    if (!workoutDay) {
      throw new NotFoundError(`Workout plan day for "${date}" was not found.`);
    }

    const progressDay = await this.getOrCreateProgressDay(user, date);
    const nextDay = recalculateTotals({
      ...progressDay,
      planDayNumber: getPlanDayNumber(date),
      planDayName: getPlanDayName(date),
      targets: {
        kilojoules: Math.round(user.kilojoulesTarget),
        calories: toCaloriesFromKilojoules(Math.round(user.kilojoulesTarget)),
      },
      workout: resolveWorkoutStatus(workoutDay, command.completed),
    });

    const savedDay = await this.repositoryUser.saveUserProgressDay(nextDay);
    await this.repositoryUser.syncWorkoutPlanDayCompletionState(
      command.userId,
      nextDay.planDayNumber,
      nextDay.workout.completed,
    );
    await this.repositoryUser.replaceUserExerciseLogs(
      command.userId,
      date,
      command.completed
        ? this.resolveWorkoutExerciseLogs(command.exerciseLogs, workoutDay)
        : [],
    );
    await this.syncTrackingEntry({
      user,
      date,
      progressDay: savedDay,
      dietDay: await this.getDietDayForTracking(user, date),
      workoutDay,
    });

    return savedDay;
  }

  async getDay(query: GetUserProgressDayQuery): Promise<UserProgressDay> {
    const date = normaliseDate(query.date);
    const user = await this.getUser(query.userId);
    const progressDay = await this.repositoryUser.getUserProgressDay(query.userId, date);

    return progressDay ?? createEmptyProgressDay(user, date);
  }

  async getSummary(query: GetUserProgressSummaryQuery): Promise<UserProgressSummary> {
    const date = normaliseDate(query.date);
    const user = await this.getUser(query.userId);
    const { rangeStart, rangeEnd } = resolvePeriodRange(query.period, date);
    const rows = await this.repositoryUser.listUserProgressDays(
      query.userId,
      rangeStart,
      rangeEnd,
    );

    const totals = rows.reduce<UserProgressSummary["totals"]>(
      (currentTotals, row) => ({
        ...sumTotals(currentTotals, row.totals),
        trackedDays: currentTotals.trackedDays + 1,
      }),
      {
        ...createEmptyTotals(),
        trackedDays: 0,
      },
    );

    if (rows.length === 0 && query.period === "day") {
      const emptyDay = createEmptyProgressDay(user, date);

      return {
        userId: query.userId,
        period: query.period,
        referenceDate: date,
        rangeStart,
        rangeEnd,
        totals: {
          ...emptyDay.totals,
          trackedDays: 0,
        },
        breakdown: buildBreakdown([], query.period, date),
      };
    }

    return {
      userId: query.userId,
      period: query.period,
      referenceDate: date,
      rangeStart,
      rangeEnd,
      totals,
      breakdown: buildBreakdown(rows, query.period, date),
    };
  }

  async getTracking(query: GetUserTrackingEntriesQuery): Promise<UserTrackingEntry[]> {
    const startDate = normaliseDate(query.startDate);
    const endDate = normaliseDate(query.endDate);
    assertDateRange(startDate, endDate);
    await this.getUser(query.userId);

    return this.repositoryUser.listUserTrackingEntries(query.userId, startDate, endDate);
  }

  async getWater(query: GetUserWaterEntriesQuery): Promise<UserWaterEntry[]> {
    const startDate = normaliseDate(query.startDate);
    const endDate = normaliseDate(query.endDate);
    assertDateRange(startDate, endDate);
    const user = await this.getUser(query.userId);
    const storedEntries = await this.repositoryUser.listUserWaterEntries(query.userId, startDate, endDate);
    const storedByDate = new Map(storedEntries.map((entry) => [entry.date, entry]));

    return buildDateRange(startDate, endDate).map((date) => (
      this.resolveWaterEntry(user, date, storedByDate.get(date))
    ));
  }

  async getExerciseLogs(query: GetUserExerciseLogsQuery): Promise<UserExerciseLog[]> {
    const startDate = normaliseDate(query.startDate);
    const endDate = normaliseDate(query.endDate);
    assertDateRange(startDate, endDate);
    await this.getUser(query.userId);

    return this.repositoryUser.listUserExerciseLogs(query.userId, startDate, endDate);
  }

  async trackWater(command: TrackWaterProgressCommand): Promise<UserWaterEntry> {
    const date = normaliseDate(command.date);
    assertNotFutureDate(date);
    const user = await this.getUser(command.userId);
    const target = this.waterRequirementService.calculate(user);
    const normalizedGlassesCompleted = Number.isFinite(command.glassesCompleted)
      ? Math.round(command.glassesCompleted)
      : 0;
    const glassesCompleted = Math.max(
      0,
      Math.min(target.targetGlasses, normalizedGlassesCompleted),
    );

    return this.repositoryUser.saveUserWaterEntry({
      userId: command.userId,
      date,
      targetLiters: target.targetLiters,
      targetGlasses: target.targetGlasses,
      glassesCompleted,
      litersPerGlass: target.litersPerGlass,
      completedLiters: Math.round(glassesCompleted * target.litersPerGlass * 10) / 10,
    });
  }

  private resolveWorkoutExerciseLogs(
    exerciseLogs: UserExerciseLogInput[] | undefined,
    workoutDay: WorkoutPlanDay,
  ): UserExerciseLogInput[] {
    const defaults = buildDefaultExerciseLogs(workoutDay);

    if (!exerciseLogs || exerciseLogs.length === 0) {
      return defaults;
    }

    const defaultsByExercise = new Map(defaults.map((log) => [log.exerciseName, log]));

    for (const log of exerciseLogs) {
      if (!defaultsByExercise.has(log.exerciseName)) {
        throw new ValidationError(`Exercise "${log.exerciseName}" is not part of this workout day.`);
      }

      if (
        !Number.isFinite(log.setsCompleted)
        || !Number.isFinite(log.repsCompleted)
        || !Number.isFinite(log.weightUsed)
        || log.setsCompleted < 0
        || log.repsCompleted < 0
        || log.weightUsed < 0
      ) {
        throw new ValidationError("Exercise log values must be valid non-negative numbers.");
      }
    }

    const providedByExercise = new Map(exerciseLogs.map((log) => [log.exerciseName, log]));

    return defaults.map((log) => {
      const provided = providedByExercise.get(log.exerciseName);

      return provided ? {
        exerciseName: provided.exerciseName,
        setsCompleted: Math.round(provided.setsCompleted),
        repsCompleted: Math.round(provided.repsCompleted),
        weightUsed: Math.round(provided.weightUsed * 100) / 100,
      } : log;
    });
  }

  private async getDietDayForTracking(
    user: DataUserCommand,
    date: string,
    options?: {
      dietType?: "single-food" | "recipes";
      week?: "current" | "next";
    },
  ): Promise<DietPlanDay | null> {
    const dietType = options?.dietType ?? (
      user.kindOfDiet === "single-food" ? "single-food" : "recipes"
    );
    const dietPlan = await this.repositoryUser.getDietPlan(user.id, {
      dietType,
      week: options?.week ?? "current",
    });

    if (!dietPlan) {
      return null;
    }

    return findDietPlanDay(dietPlan, date);
  }

  private async getWorkoutDay(
    userId: string,
    date: string,
  ): Promise<WorkoutPlanDay | null> {
    const workoutPlan = await this.repositoryUser.getWorkoutPlan(userId);

    if (!workoutPlan) {
      return null;
    }

    return findWorkoutPlanDay(workoutPlan, date);
  }

  private async syncTrackingEntry(args: {
    user: DataUserCommand;
    date: string;
    progressDay: UserProgressDay;
    dietDay: DietPlanDay | null;
    workoutDay: WorkoutPlanDay | null;
  }): Promise<void> {
    const dietTargets = resolveDietTargets(args.dietDay);

    await this.repositoryUser.saveUserTrackingEntry({
      userId: args.user.id,
      date: args.date,
      kjsConsumed: args.progressDay.totals.kilojoulesConsumed,
      macrosConsumed: cloneMacroTotals(args.progressDay.macroTotals),
      kjsTarget: dietTargets.kjsTarget,
      macrosTarget: cloneMacroTotals(dietTargets.macrosTarget),
      kjsBurned: args.progressDay.totals.kilojoulesBurned,
      kjsBurnedTarget: resolveWorkoutTarget(args.workoutDay),
    });
  }

  private async getUser(userId: string): Promise<DataUserCommand> {
    const user = await this.repositoryUser.getDataUser({ id: userId });

    if (!user) {
      throw new NotFoundError(`User with id "${userId}" was not found.`);
    }

    return user;
  }

  private async getOrCreateProgressDay(
    user: DataUserCommand,
    date: string,
  ): Promise<UserProgressDay> {
    const progressDay = await this.repositoryUser.getUserProgressDay(user.id, date);

    return progressDay ?? createEmptyProgressDay(user, date);
  }

  private resolveWaterEntry(
    user: DataUserCommand,
    date: string,
    storedEntry?: UserWaterEntry,
  ): UserWaterEntry {
    const target = this.waterRequirementService.calculate(user);
    const glassesCompleted = Math.max(
      0,
      Math.min(target.targetGlasses, storedEntry?.glassesCompleted ?? 0),
    );

    return {
      userId: user.id,
      date,
      targetLiters: target.targetLiters,
      targetGlasses: target.targetGlasses,
      glassesCompleted,
      litersPerGlass: target.litersPerGlass,
      completedLiters: Math.round(glassesCompleted * target.litersPerGlass * 10) / 10,
    };
  }
}
