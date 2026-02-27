import type { JwtUser } from "../utils/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
      validatedBody?: unknown;
    }
  }
}

export {};
