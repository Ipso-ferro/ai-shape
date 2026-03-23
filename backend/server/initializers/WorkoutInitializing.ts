import { Router } from "express";
import { authHandler } from "../../domain/auth";
import { AuthHandler } from "../../domain/auth/handlers/AuthHandler";
import { workoutsHandler } from "../../domain/workouts";
import { WorkoutsHandler } from "../../domain/workouts/handlers/WorkoutsHandler";
import { WorkoutController } from "../controllers/WorkoutController";
import { createRequireUserAccess } from "../middlewares/AuthMiddleware";

export const initializeWorkoutRoutes = (
  handler: WorkoutsHandler = workoutsHandler,
  sessionHandler: AuthHandler = authHandler,
): Router => {
  const router = Router();
  const workoutController = new WorkoutController(handler);
  const requireUserAccess = createRequireUserAccess(sessionHandler);

  router.use("/users/:id", requireUserAccess);
  router.get("/users/:id/plan", workoutController.getPlan);
  router.post("/users/:id/plan", workoutController.generatePlan);

  return router;
};
