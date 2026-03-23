import { NextFunction, Request, Response } from "express";
import { DietCommand } from "../../domain/diet/command/DietCommand";
import { DietHandler } from "../../domain/diet/handlers/DietHandler";
import {
  GenerateDietPlanRequestBody,
  UserRouteParams,
} from "../requests/AddNewUserRequest";

export class DietController {
  constructor(private readonly dietHandler: DietHandler) {}

  getPlan = async (
    req: Request<UserRouteParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const plan = await this.dietHandler.getPlan(req.params.id);
      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  };

  generatePlan = async (
    req: Request<UserRouteParams, unknown, GenerateDietPlanRequestBody>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const command: DietCommand = {
        userId: req.params.id,
        dietType: req.body?.dietType,
      };

      const plan = await this.dietHandler.generatePlan(command);
      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  };
}
