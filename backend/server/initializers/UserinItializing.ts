import { Router } from "express";
import { authHandler } from "../../domain/auth";
import { AuthHandler } from "../../domain/auth/handlers/AuthHandler";
import { userHandler, userPlanHandler } from "../../domain/user";
import { UserHandler } from "../../domain/user/handlers/UserHandler";
import { UserPlanHandler } from "../../domain/user/handlers/UserPlanHandler";
import { UserController } from "../controllers/UserController";
import { createRequireAuthentication, createRequireUserAccess } from "../middlewares/AuthMiddleware";

export const initializeUserRoutes = (
  handler: UserHandler = userHandler,
  planHandler: UserPlanHandler = userPlanHandler,
  sessionHandler: AuthHandler = authHandler,
): Router => {
  const router = Router();
  const userController = new UserController(handler, planHandler);
  const requireAuthentication = createRequireAuthentication(sessionHandler);
  const requireUserAccess = createRequireUserAccess(sessionHandler);

  router.post("/", userController.addNewUser);
  router.get("/", requireAuthentication, userController.getAllUsers);
  router.use("/:id", requireUserAccess);
  router.put("/:id", userController.saveDataUser);
  router.post("/:id/complete-plan", userController.generateCompletePlan);
  router.get("/:id", userController.getDataUser);

  return router;
};
