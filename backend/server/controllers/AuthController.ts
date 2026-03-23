import { NextFunction, Request, Response } from "express";
import { AuthHandler } from "../../domain/auth/handlers/AuthHandler";
import {
  GoogleAuthRequestBody,
  LoginUserRequestBody,
  RegisterUserRequestBody,
} from "../requests/AuthRequest";

export class AuthController {
  constructor(private readonly authHandler: AuthHandler) {}

  register = async (
    req: Request<unknown, unknown, RegisterUserRequestBody>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const session = await this.authHandler.register(req.body);
      res.status(201).json(session);
    } catch (error) {
      next(error);
    }
  };

  login = async (
    req: Request<unknown, unknown, LoginUserRequestBody>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const session = await this.authHandler.login(req.body);
      res.status(200).json(session);
    } catch (error) {
      next(error);
    }
  };

  google = async (
    req: Request<unknown, unknown, GoogleAuthRequestBody>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const session = await this.authHandler.authenticateWithGoogle(req.body);
      res.status(200).json(session);
    } catch (error) {
      next(error);
    }
  };

  getSession = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.auth) {
        throw new Error("Missing authenticated request context.");
      }

      const session = await this.authHandler.getSession({
        sub: req.auth.userId,
        email: req.auth.email,
        exp: Math.floor(new Date(req.auth.expiresAt).getTime() / 1000),
        iat: 0,
      });

      res.status(200).json({
        ...session,
        token: "",
      });
    } catch (error) {
      next(error);
    }
  };
}
