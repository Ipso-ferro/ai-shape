import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:8080"),
  DATABASE_CONNECTION_NAME: z.string().default("testFitApp"),
  DATABASE_HOST: z.string().default("127.0.0.1"),
  DATABASE_PORT: z.coerce.number().int().positive().default(3306),
  DATABASE_USER: z.string().default("root"),
  DATABASE_PASSWORD: z.string().default(""),
  DATABASE_NAME: z.string().default("testFitApp"),
  DATABASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().min(20, "OPENAI_API_KEY is required"),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters")
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

const config = parsed.data;
const user = encodeURIComponent(config.DATABASE_USER);
const password = encodeURIComponent(config.DATABASE_PASSWORD);
const fallbackDatabaseUrl = `mysql://${user}:${password}@${config.DATABASE_HOST}:${config.DATABASE_PORT}/${config.DATABASE_NAME}`;

export const env = {
  ...config,
  DATABASE_URL: config.DATABASE_URL || fallbackDatabaseUrl,
  ALLOWED_ORIGINS: config.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
};
