import { Router } from "express";
import { authHandler } from "../../domain/auth";
import { AuthHandler } from "../../domain/auth/handlers/AuthHandler";
import { AuthController } from "../controllers/AuthController";
import { createRequireAuthentication } from "../middlewares/AuthMiddleware";

export const initializeAuthRoutes = (
  handler: AuthHandler = authHandler,
): Router => {
  const router = Router();
  const controller = new AuthController(handler);
  const requireAuthentication = createRequireAuthentication(handler);

  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.post("/google", controller.google);
  router.get("/session", requireAuthentication, controller.getSession);

  return router;
};
