import { Router } from "express";
import { authHandler } from "../../domain/auth";
import { AuthHandler } from "../../domain/auth/handlers/AuthHandler";
import { dietHandler } from "../../domain/diet";
import { DietHandler } from "../../domain/diet/handlers/DietHandler";
import { DietController } from "../controllers/DietController";
import { createRequireUserAccess } from "../middlewares/AuthMiddleware";

export const initializeDietRoutes = (
  handler: DietHandler = dietHandler,
  sessionHandler: AuthHandler = authHandler,
): Router => {
  const router = Router();
  const controller = new DietController(handler);
  const requireUserAccess = createRequireUserAccess(sessionHandler);

  router.use("/users/:id", requireUserAccess);
  router.get("/users/:id/plan", controller.getPlan);
  router.post("/users/:id/plan", controller.generatePlan);

  return router;
};
