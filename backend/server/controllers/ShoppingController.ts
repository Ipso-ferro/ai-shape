import { NextFunction, Request, Response } from "express";
import { ShoppingListHandler } from "../../domain/shopping/handlers/ShoppingListHandler";
import { UserRouteParams } from "../requests/AddNewUserRequest";
import { ShoppingItemRouteParams, ToggleShoppingItemRequestBody } from "../requests/ShoppingRequest";

export class ShoppingController {
  constructor(private readonly shoppingListHandler: ShoppingListHandler) {}

  getList = async (
    req: Request<UserRouteParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const shoppingList = await this.shoppingListHandler.getList(req.params.id);
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
      );
      res.status(200).json(shoppingList);
    } catch (error) {
      next(error);
    }
  };
}
