import type { NextFunction, Request, Response } from "express";

type AppError = Error & {
  statusCode?: number;
  issues?: unknown;
  cause?: unknown;
};

export function notFoundHandler(_req: Request, res: Response) {
  return res.status(404).json({ message: "Route not found" });
}

export function errorHandler(error: AppError, _req: Request, res: Response, _next: NextFunction) {
  const statusCode: number =
    typeof error.statusCode === "number" && Number.isInteger(error.statusCode)
      ? error.statusCode
      : 500;
  const message = statusCode >= 500 ? "Internal server error" : error.message || "Request failed";

  if (statusCode >= 500) {
    const causeMessage =
      error.cause && typeof error.cause === "object" && "message" in error.cause
        ? String((error.cause as { message?: unknown }).message)
        : undefined;
    // eslint-disable-next-line no-console
    console.error({ statusCode, message: error.message, cause: causeMessage });
  }

  return res.status(statusCode).json({
    message,
    errors: error.issues
  });
}
