import { Router } from "express";
import { authHandler } from "../../domain/auth";
import { AuthHandler } from "../../domain/auth/handlers/AuthHandler";
import { shoppingListHandler } from "../../domain/shopping";
import { ShoppingListHandler } from "../../domain/shopping/handlers/ShoppingListHandler";
import { ShoppingController } from "../controllers/ShoppingController";
import { createRequireUserAccess } from "../middlewares/AuthMiddleware";

export const initializeShoppingRoutes = (
  handler: ShoppingListHandler = shoppingListHandler,
  sessionHandler: AuthHandler = authHandler,
): Router => {
  const router = Router();
  const controller = new ShoppingController(handler);
  const requireUserAccess = createRequireUserAccess(sessionHandler);

  router.use("/users/:id", requireUserAccess);
  router.get("/users/:id/list", controller.getList);
  router.put("/users/:id/items/:itemId", controller.toggleItem);

  return router;
};
