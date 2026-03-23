import { NextFunction, Request, Response } from "express";
import { AuthHandler } from "../../domain/auth/handlers/AuthHandler";
import { authHandler } from "../../domain/auth";
import { ForbiddenError, UnauthorizedError } from "../../domain/share/Errors/AppErrors";

const extractBearerToken = (request: Request): string => {
  const authorizationHeader = request.headers.authorization;

  if (!authorizationHeader) {
    throw new UnauthorizedError("Missing authorization token.");
  }

  const headerValue = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;
  const [scheme, token] = headerValue.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new UnauthorizedError("Authorization header must use Bearer token.");
  }

  return token;
};

export const createRequireAuthentication = (
  handler: AuthHandler = authHandler,
) => (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const token = extractBearerToken(req);
    const payload = handler.verifyToken(token);

    req.auth = {
      userId: payload.sub,
      email: payload.email,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const createRequireUserAccess = (
  handler: AuthHandler = authHandler,
) => {
  const requireAuthentication = createRequireAuthentication(handler);

  return (req: Request, res: Response, next: NextFunction): void => {
    requireAuthentication(req, res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }

      if (!req.auth) {
        next(new UnauthorizedError("Missing authenticated request context."));
        return;
      }

      if (typeof req.params?.id === "string" && req.params.id !== req.auth.userId) {
        next(new ForbiddenError("You can only access your own resources."));
        return;
      }

      next();
    });
  };
};
