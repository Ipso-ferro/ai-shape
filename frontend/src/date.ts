import { WeekDay } from "./types";

const weekLabels = [
  { label: "Monday", shortLabel: "Mon" },
  { label: "Tuesday", shortLabel: "Tue" },
  { label: "Wednesday", shortLabel: "Wed" },
  { label: "Thursday", shortLabel: "Thu" },
  { label: "Friday", shortLabel: "Fri" },
  { label: "Saturday", shortLabel: "Sat" },
  { label: "Sunday", shortLabel: "Sun" },
] as const;

const toDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const toMonthKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
};

export const todayKey = (): string => toDateKey(new Date());
export const monthKey = (value = new Date()): string => toMonthKey(value);
export const isSunday = (value = new Date()): boolean => value.getDay() === 0;

export const formatNumber = (value: number): string => (
  new Intl.NumberFormat("en-US").format(Math.round(value))
);

export const humanDate = (date: string): string => {
  const value = new Date(`${date}T00:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(value);
};

export const getCurrentWeek = (referenceDate = new Date()): WeekDay[] => {
  const cursor = new Date(referenceDate);
  const dayOfWeek = cursor.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  cursor.setDate(cursor.getDate() + mondayOffset);

  return weekLabels.map((item, index) => {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + index);

    return {
      dayNumber: index + 1,
      date: toDateKey(day),
      label: item.label,
      shortLabel: item.shortLabel,
    };
  });
};
