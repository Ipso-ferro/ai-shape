import { NotFoundError, ValidationError } from "../../../share/Errors/AppErrors";
import { RepositoryUser } from "../../../user/repositories/RepositoryUser";
import { TrackMealProgressCommand } from "../../command/TrackMealProgressCommand";
import { TrackWorkoutProgressCommand } from "../../command/TrackWorkoutProgressCommand";
import { GetUserProgressDayQuery } from "../../queries/GetUserProgressDayQuery";
import { GetUserProgressSummaryQuery } from "../../queries/GetUserProgressSummaryQuery";
import {
  DataUserCommand,
  DietPlan,
  DietPlanDay,
  DietPlanEntry,
  TrackableMealSlot,
  UserProgressBreakdownItem,
  UserProgressDay,
  UserProgressMealStatus,
  UserProgressPeriod,
  UserProgressSummary,
  UserProgressTotals,
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
  constructor(private readonly repositoryUser: RepositoryUser) {}

  async trackMeal(command: TrackMealProgressCommand): Promise<UserProgressDay> {
    const date = normaliseDate(command.date);
    const user = await this.getUser(command.userId);
    const dietPlan = await this.repositoryUser.getDietPlan(command.userId);

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

    return this.repositoryUser.saveUserProgressDay(nextDay);
  }

  async trackWorkout(command: TrackWorkoutProgressCommand): Promise<UserProgressDay> {
    const date = normaliseDate(command.date);
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

    return this.repositoryUser.saveUserProgressDay(nextDay);
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
}
