import { NextFunction, Request, Response } from "express";
import { WorkoutsCommand } from "../../domain/workouts/command/WorkoutsCommand";
import { WorkoutsHandler } from "../../domain/workouts/handlers/WorkoutsHandler";
import { UserRouteParams } from "../requests/AddNewUserRequest";

export class WorkoutController {
  constructor(private readonly workoutsHandler: WorkoutsHandler) {}

  getPlan = async (
    req: Request<UserRouteParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const plan = await this.workoutsHandler.getPlan(req.params.id);
      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  };

  generatePlan = async (
    req: Request<UserRouteParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const command: WorkoutsCommand = {
        userId: req.params.id,
      };

      const plan = await this.workoutsHandler.generatePlan(command);
      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  };
}
