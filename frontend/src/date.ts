import { WeekDay } from "./types";

const weekdayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const fromDateKey = (value: string): Date => {
  const [yearText, monthText, dayText] = value.split("-");
  return new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
};

export const todayKey = (): string => toDateKey(new Date());

export const humanDate = (date: string): string => (
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(fromDateKey(date))
);

export const getCurrentWeek = (referenceDate = new Date()): WeekDay[] => {
  const cursor = new Date(referenceDate);
  const weekday = cursor.getDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  cursor.setDate(cursor.getDate() + diffToMonday);
  cursor.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(cursor);
    next.setDate(cursor.getDate() + index);

    return {
      date: toDateKey(next),
      dayNumber: index + 1,
      dayName: weekdayNames[index],
      shortLabel: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
      }).format(next),
    };
  });
};

export const formatNumber = (value: number): string => (
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
);
