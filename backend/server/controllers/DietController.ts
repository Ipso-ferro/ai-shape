import { NextFunction, Request, Response } from "express";
import { DietCommand } from "../../domain/diet/command/DietCommand";
import { DietHandler } from "../../domain/diet/handlers/DietHandler";
import {
  GenerateDietPlanRequestBody,
  PlanSelectionQuery,
  UserRouteParams,
} from "../requests/AddNewUserRequest";

export class DietController {
  constructor(private readonly dietHandler: DietHandler) {}

  getPlan = async (
    req: Request<UserRouteParams, unknown, unknown, PlanSelectionQuery>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const plan = await this.dietHandler.getPlan(req.params.id, {
        dietType: req.query?.dietType === "single-food" ? "single-food" : req.query?.dietType === "recipes" ? "recipes" : undefined,
        week: req.query?.week === "next" ? "next" : req.query?.week === "current" ? "current" : undefined,
      });
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
        week: req.body?.week,
        activateDietType: req.body?.activateDietType,
      };

      const plan = await this.dietHandler.generatePlan(command);
      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  };
}
