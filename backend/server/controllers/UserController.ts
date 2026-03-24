import { NextFunction, Request, Response } from "express";
import { AddNewUserCommand } from "../../domain/user/command/AddNewUserCommand";
import { GenerateCompletePlanCommand } from "../../domain/user/command/GenerateCompletePlanCommand";
import { SaveDataUserCommand } from "../../domain/user/command/SaveDataUserCommand";
import { UserHandler } from "../../domain/user/handlers/UserHandler";
import { UserPlanHandler } from "../../domain/user/handlers/UserPlanHandler";
import {
  AddNewUserRequestBody,
  GenerateCompletePlanRequestBody,
  SaveDataUserRequestBody,
  UserRouteParams,
} from "../requests/AddNewUserRequest";

export class UserController {
  constructor(
    private readonly userHandler: UserHandler,
    private readonly userPlanHandler: UserPlanHandler,
  ) {}

  addNewUser = async (
    req: Request<unknown, unknown, AddNewUserRequestBody>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.userHandler.addNewUser(
        req.body as AddNewUserCommand,
      );
      res.status(result.status).json({
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  saveDataUser = async (
    req: Request<UserRouteParams, unknown, SaveDataUserRequestBody>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const command: SaveDataUserCommand = {
        id: req.params.id,
        ...req.body,
      };

      const result = await this.userHandler.saveDataUser(command);
      res.status(result.status).json({ message: result.message });
    } catch (error) {
      next(error);
    }
  };

  getDataUser = async (
    req: Request<UserRouteParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = await this.userHandler.getDataUser({ id: req.params.id });
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  };

  getAllUsers = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const users = await this.userHandler.getAllUsers();
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  };

  generateCompletePlan = async (
    req: Request<UserRouteParams, unknown, GenerateCompletePlanRequestBody>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const command: GenerateCompletePlanCommand = {
        userId: req.params.id,
        dietType: req.body?.dietType,
        week: req.body?.week,
      };

      const result = await this.userPlanHandler.generateCompletePlan(command);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
