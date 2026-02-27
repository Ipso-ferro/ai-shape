import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type JwtUser = {
  userId: string;
  email: string;
};

const TOKEN_EXPIRY = "14d";
export const AUTH_COOKIE_NAME = "probody_token";

export function signAuthToken(payload: JwtUser): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyAuthToken(token: string): JwtUser | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtUser;
  } catch {
    return null;
  }
}
