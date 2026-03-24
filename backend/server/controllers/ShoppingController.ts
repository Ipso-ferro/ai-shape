import { NextFunction, Request, Response } from "express";
import { ShoppingListHandler } from "../../domain/shopping/handlers/ShoppingListHandler";
import {
  PlanSelectionQuery,
  UserRouteParams,
} from "../requests/AddNewUserRequest";
import { ShoppingItemRouteParams, ToggleShoppingItemRequestBody } from "../requests/ShoppingRequest";

export class ShoppingController {
  constructor(private readonly shoppingListHandler: ShoppingListHandler) {}

  getList = async (
    req: Request<UserRouteParams, unknown, unknown, PlanSelectionQuery>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const shoppingList = await this.shoppingListHandler.getList(req.params.id, {
        dietType: req.query?.dietType === "single-food" ? "single-food" : req.query?.dietType === "recipes" ? "recipes" : undefined,
        week: req.query?.week === "next" ? "next" : req.query?.week === "current" ? "current" : undefined,
      });
      res.status(200).json(shoppingList);
    } catch (error) {
      next(error);
    }
  };

  toggleItem = async (
    req: Request<ShoppingItemRouteParams, unknown, ToggleShoppingItemRequestBody>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const shoppingList = await this.shoppingListHandler.toggleItem(
        req.params.id,
        req.params.itemId,
        req.body?.checked ?? true,
        {
          dietType: req.body?.dietType,
          week: req.body?.week,
        },
      );
      res.status(200).json(shoppingList);
    } catch (error) {
      next(error);
    }
  };
}
