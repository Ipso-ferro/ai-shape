import { Router } from "express";
import { authHandler } from "../../domain/auth";
import { AuthHandler } from "../../domain/auth/handlers/AuthHandler";
import { progressHandler } from "../../domain/progress";
import { ProgressHandler } from "../../domain/progress/handlers/ProgressHandler";
import { ProgressController } from "../controllers/ProgressController";
import { createRequireUserAccess } from "../middlewares/AuthMiddleware";

export const initializeProgressRoutes = (
  handler: ProgressHandler = progressHandler,
  sessionHandler: AuthHandler = authHandler,
): Router => {
  const router = Router();
  const controller = new ProgressController(handler);
  const requireUserAccess = createRequireUserAccess(sessionHandler);

  router.use("/users/:id", requireUserAccess);
  router.get("/users/:id/day", controller.getDay);
  router.get("/users/:id/summary", controller.getSummary);
  router.put("/users/:id/meals/:mealSlot", controller.trackMeal);
  router.put("/users/:id/workout", controller.trackWorkout);

  return router;
};
