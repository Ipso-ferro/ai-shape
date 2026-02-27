import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "../utils/jwt.js";

export function attachUserFromCookie(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    return next();
  }
  const payload = verifyAuthToken(token);
  if (payload) {
    req.user = payload;
  }
  return next();
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
}
