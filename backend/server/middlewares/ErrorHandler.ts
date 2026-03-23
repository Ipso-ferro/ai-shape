import { NextFunction, Request, Response } from "express";
import { AppErrors } from "../../domain/share/Errors/AppErrors"
export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof AppErrors) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
};
