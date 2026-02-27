import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { attachUserFromCookie } from "./middleware/auth.js";
import { asyncHandler } from "./middleware/async-handler.js";
import { requireUser } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { aiRouter } from "./routes/ai.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { profileRouter } from "./routes/profile.routes.js";
import { getCustomerAiPlans } from "./services/plan-generation.service.js";

export function createApp() {
  const app = express();
  const corsDelegate = (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void
  ) => {
    if (!origin || env.ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed"));
  };

  app.use(helmet());
  app.use(
    cors({
      origin: corsDelegate,
      credentials: true
    })
  );
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 240,
      standardHeaders: "draft-7",
      legacyHeaders: false
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(attachUserFromCookie);

  app.get("/health", (_req, res) => {
    return res.status(200).json({
      data: {
        status: "ok",
        service: "ai-shape-backend"
      }
    });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/profile", profileRouter);
  app.use("/api/v1/ai", aiRouter);
  app.get(
    "/api/v1/customers/:customerId/ai-plans",
    requireUser,
    asyncHandler(async (req, res) => {
      const customerId = String(req.params.customerId);
      if (customerId !== req.user!.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const data = await getCustomerAiPlans(customerId);
      return res.status(200).json({ data });
    })
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
