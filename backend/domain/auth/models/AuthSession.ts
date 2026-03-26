import { DataUserCommand } from "../../user/command/DataUserCommand";

export interface AuthAccount {
  email: string;
  provider: "password" | "google";
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: DataUserCommand;
  account: AuthAccount;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  exp: number;
  iat: number;
}
