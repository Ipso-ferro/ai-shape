import express, { Express, NextFunction, Request, Response } from "express";
import { NotFoundError } from "../domain/share/Errors/AppErrors";
import { AuthHandler } from "../domain/auth/handlers/AuthHandler";
import { UserHandler } from "../domain/user/handlers/UserHandler";
import { UserPlanHandler } from "../domain/user/handlers/UserPlanHandler";
import { DietHandler } from "../domain/diet/handlers/DietHandler";
import { WorkoutsHandler } from "../domain/workouts/handlers/WorkoutsHandler";
import { ProgressHandler } from "../domain/progress/handlers/ProgressHandler";
import { ShoppingListHandler } from "../domain/shopping/handlers/ShoppingListHandler";
import { appConfig } from "./config";
import { initializeAuthRoutes } from "./initializers/AuthInitializing";
import { initializeDietRoutes } from "./initializers/DietInitializing";
import { initializeProgressRoutes } from "./initializers/ProgressInitializing";
import { initializeShoppingRoutes } from "./initializers/ShoppingInitializing";
import { initializeUserRoutes } from "./initializers/UserinItializing";
import { initializeWorkoutRoutes } from "./initializers/WorkoutInitializing";
import { initializeDatabaseSchema } from "./initializers/DatabaseSchemaInitializing";
import { errorHandler } from "./middlewares/ErrorHandler";
import { mysqlPool } from "./pool";

interface ServerDependencies {
  authHandler?: AuthHandler;
  userHandler?: UserHandler;
  userPlanHandler?: UserPlanHandler;
  dietHandler?: DietHandler;
  workoutsHandler?: WorkoutsHandler;
  progressHandler?: ProgressHandler;
  shoppingListHandler?: ShoppingListHandler;
}

export const createServer = (dependencies: ServerDependencies = {}): Express => {
  const app = express();

  app.use((req: any, res: any, next: any) => {
    const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;

    if (origin && appConfig.frontendOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  });

  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/auth", initializeAuthRoutes(dependencies.authHandler));
  app.use(
    "/users",
    initializeUserRoutes(
      dependencies.userHandler,
      dependencies.userPlanHandler,
      dependencies.authHandler,
    ),
  );
  app.use("/diets", initializeDietRoutes(dependencies.dietHandler, dependencies.authHandler));
  app.use("/workouts", initializeWorkoutRoutes(dependencies.workoutsHandler, dependencies.authHandler));
  app.use("/progress", initializeProgressRoutes(dependencies.progressHandler, dependencies.authHandler));
  app.use("/shopping", initializeShoppingRoutes(dependencies.shoppingListHandler, dependencies.authHandler));

  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError("Route not found."));
  });

  app.use(errorHandler);

  return app;
};

const bootstrap = async (): Promise<void> => {
  await mysqlPool.query("SELECT 1");
  await initializeDatabaseSchema(mysqlPool);

  const app = createServer();
  app.listen(appConfig.port, () => {
    console.log(`Server running on port ${appConfig.port}`);
  });
};

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
}
