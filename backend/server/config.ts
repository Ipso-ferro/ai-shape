import { config as loadEnv } from "dotenv";
import { resolve } from "path";

loadEnv({ path: resolve(process.cwd(), ".env") });

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
}

export interface AppConfig {
  port: number;
  frontendOrigins: string[];
}

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];

  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const getNumberFromEnv = (value: string | undefined, fallback: number): number => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const getListFromEnv = (value: string | undefined, fallback: string[]): string[] => {
  const parsedValue = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsedValue.length > 0 ? parsedValue : fallback;
};

export const databaseConfig: DatabaseConfig = {
  host: getRequiredEnv("DB_HOST"),
  port: getNumberFromEnv(getRequiredEnv("DB_PORT"), 3306),
  user: getRequiredEnv("DB_USER"),
  password: process.env.DB_PASSWORD ?? "",
  database: getRequiredEnv("DB_NAME"),
  connectionLimit: getNumberFromEnv(process.env.DB_CONNECTION_LIMIT, 10),
};

export const appConfig: AppConfig = {
  port: getNumberFromEnv(getRequiredEnv("PORT"), 3000),
  frontendOrigins: getListFromEnv(
    process.env.FRONTEND_ORIGINS,
    ["http://localhost:5173", "http://127.0.0.1:5173"],
  ),
};
