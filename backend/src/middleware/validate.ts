import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return resBadRequest(next, parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      })));
    }
    req.validatedBody = parsed.data;
    return next();
  };
}

function resBadRequest(next: NextFunction, issues: Array<{ field: string; message: string }>) {
  const error = new Error("Invalid request body") as Error & {
    statusCode?: number;
    issues?: Array<{ field: string; message: string }>;
  };
  error.statusCode = 400;
  error.issues = issues;
  return next(error);
}
