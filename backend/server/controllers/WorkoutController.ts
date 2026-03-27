import { NextFunction, Request, Response } from "express";
import { WorkoutsCommand } from "../../domain/workouts/command/WorkoutsCommand";
import { WorkoutsHandler } from "../../domain/workouts/handlers/WorkoutsHandler";
import {
  GenerateWorkoutPlanRequestBody,
  PlanSelectionQuery,
  UserRouteParams,
} from "../requests/AddNewUserRequest";

export class WorkoutController {
  constructor(private readonly workoutsHandler: WorkoutsHandler) {}

  getPlan = async (
    req: Request<UserRouteParams, unknown, unknown, PlanSelectionQuery>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const plan = await this.workoutsHandler.getPlan(
        req.params.id,
        req.query?.week === "next" ? "next" : req.query?.week === "current" ? "current" : undefined,
      );
      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  };

  generatePlan = async (
    req: Request<UserRouteParams, unknown, GenerateWorkoutPlanRequestBody>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const command: WorkoutsCommand = {
        userId: req.params.id,
        week: req.body?.week === "next" ? "next" : req.body?.week === "current" ? "current" : undefined,
      };

      const plan = await this.workoutsHandler.generatePlan(command);
      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  };
}
