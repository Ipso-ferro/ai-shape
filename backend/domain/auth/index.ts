import { repositoryUser } from "../user";
import { AuthHandler } from "./handlers/AuthHandler";

export const authHandler = new AuthHandler(repositoryUser);
