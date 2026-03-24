import { NextFunction, Request, Response } from "express";
import { ProgressHandler } from "../../domain/progress/handlers/ProgressHandler";
import { ValidationError } from "../../domain/share/Errors/AppErrors";
import {
  ProgressDayRequestQuery,
  ProgressMealRouteParams,
  ProgressRouteParams,
  ProgressSummaryRequestQuery,
  TrackProgressRequestBody,
} from "../requests/ProgressRequest";
import { UserProgressPeriod } from "../../src/types";

const getDefaultDate = (): string => new Date().toISOString().slice(0, 10);

const resolveCompleted = (value: boolean | undefined): boolean => value ?? true;

const resolvePeriod = (value: string | undefined): UserProgressPeriod => {
  if (!value) {
    return "day";
  }

  if (value === "day" || value === "month" || value === "year") {
    return value;
  }

  throw new ValidationError(`Unsupported progress period "${value}".`);
};

export class ProgressController {
  constructor(private readonly progressHandler: ProgressHandler) {}

  getDay = async (
    req: Request<ProgressRouteParams, unknown, unknown, ProgressDayRequestQuery>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.progressHandler.getDay({
        userId: req.params.id,
        date: req.query.date ?? getDefaultDate(),
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getSummary = async (
    req: Request<ProgressRouteParams, unknown, unknown, ProgressSummaryRequestQuery>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.progressHandler.getSummary({
        userId: req.params.id,
        period: resolvePeriod(req.query.period),
        date: req.query.date ?? getDefaultDate(),
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  trackMeal = async (
    req: Request<ProgressMealRouteParams, unknown, TrackProgressRequestBody>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.progressHandler.trackMeal({
        userId: req.params.id,
        mealSlot: req.params.mealSlot,
        date: req.body?.date ?? getDefaultDate(),
        completed: resolveCompleted(req.body?.completed),
        dietType: req.body?.dietType === "single-food"
          ? "single-food"
          : req.body?.dietType === "recipes"
            ? "recipes"
            : undefined,
        week: req.body?.week === "next"
          ? "next"
          : req.body?.week === "current"
            ? "current"
            : undefined,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  trackWorkout = async (
    req: Request<ProgressRouteParams, unknown, TrackProgressRequestBody>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.progressHandler.trackWorkout({
        userId: req.params.id,
        date: req.body?.date ?? getDefaultDate(),
        completed: resolveCompleted(req.body?.completed),
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
