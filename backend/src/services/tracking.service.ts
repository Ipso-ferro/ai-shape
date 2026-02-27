import { prisma } from "../lib/prisma.js";
import { getWeekdayLabel, toDateOnly } from "../utils/dates.js";

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function getWeeklyMealPlan(userId: string) {
  const latest = await prisma.dietPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
  return latest;
}

export async function getDailyMeals(userId: string) {
  const logs = await prisma.mealLog.findMany({
    where: { userId },
    orderBy: [{ date: "asc" }, { id: "asc" }]
  });

  const grouped = new Map<string, Array<typeof logs[number]>>();
  for (const log of logs) {
    const key = log.date.toISOString().slice(0, 10);
    const values = grouped.get(key) ?? [];
    values.push(log);
    grouped.set(key, values);
  }

  return [...grouped.entries()].map(([date, meals]) => ({
    date,
    meals: meals.map((meal) => ({
      id: meal.id,
      type: meal.mealType,
      name: meal.name,
      recipeId: meal.recipeId,
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      ingredients: toStringArray(meal.ingredients),
      instructions: toStringArray(meal.instructions),
      eaten: meal.eaten
    }))
  }));
}

export async function setMealEaten(userId: string, mealId: number, eaten: boolean) {
  const meal = await prisma.mealLog.findFirst({
    where: { id: mealId, userId }
  });
  if (!meal) {
    const error = new Error("Meal not found") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }
  return prisma.mealLog.update({
    where: { id: mealId },
    data: { eaten }
  });
}

export async function getWorkoutSchedule(userId: string) {
  const logs = await prisma.exerciseLog.findMany({
    where: { userId },
    orderBy: [{ date: "asc" }, { id: "asc" }]
  });

  const grouped = new Map<string, Array<typeof logs[number]>>();

  for (const log of logs) {
    const key = log.weekday || getWeekdayLabel(log.date);
    const values = grouped.get(key) ?? [];
    values.push(log);
    grouped.set(key, values);
  }

  return [...grouped.entries()].map(([weekday, entries]) => {
    const first = entries[0];
    const defaultName = entries.length > 0 ? `${weekday} Training` : `${weekday} Recovery`;
    return {
      weekday,
      name: first?.name?.includes("Rest") ? "Rest / Recovery" : defaultName,
      durationMin: first?.durationMin ?? 45,
      intensity: first?.intensity ?? "Moderate",
      exercises: entries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        sets: entry.sets || "3 sets",
        notes: entry.notes || "Focus on form.",
        completed: entry.completed
      }))
    };
  });
}

export async function setExerciseCompleted(userId: string, exerciseLogId: number, completed: boolean) {
  const exercise = await prisma.exerciseLog.findFirst({
    where: { id: exerciseLogId, userId }
  });
  if (!exercise) {
    const error = new Error("Exercise log not found") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }
  return prisma.exerciseLog.update({
    where: { id: exerciseLogId },
    data: { completed }
  });
}

export async function getShoppingList(userId: string) {
  const items = await prisma.shoppingItem.findMany({
    where: { userId },
    orderBy: [{ category: "asc" }, { name: "asc" }]
  });
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    qty: item.qty,
    category: item.category,
    checked: item.checked
  }));
}

export async function getTodaySnapshot(userId: string) {
  const today = toDateOnly(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const meals = await prisma.mealLog.findMany({
    where: {
      userId,
      date: { gte: today, lt: tomorrow }
    },
    orderBy: { id: "asc" }
  });

  const exercises = await prisma.exerciseLog.findMany({
    where: {
      userId,
      date: { gte: today, lt: tomorrow }
    },
    orderBy: { id: "asc" }
  });

  return {
    date: today.toISOString().slice(0, 10),
    meals: meals.map((meal) => ({
      id: meal.id,
      type: meal.mealType,
      name: meal.name,
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      eaten: meal.eaten
    })),
    exercises: exercises.map((exercise) => ({
      id: exercise.id,
      weekday: exercise.weekday,
      name: exercise.name,
      sets: exercise.sets,
      notes: exercise.notes,
      completed: exercise.completed
    }))
  };
}
