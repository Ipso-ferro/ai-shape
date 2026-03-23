import { AddNewUserCommand } from "../../domain/user/command/AddNewUserCommand";
import { LoginUserCommand } from "../../domain/auth/command/LoginUserCommand";
import { GoogleAuthCommand } from "../../domain/auth/command/GoogleAuthCommand";

export type RegisterUserRequestBody = AddNewUserCommand;
export type LoginUserRequestBody = LoginUserCommand;
export type GoogleAuthRequestBody = GoogleAuthCommand;
