import { repositoryUser } from "../user";
import { DietHandler } from "./handlers/DietHandler";

export const dietHandler = new DietHandler(repositoryUser);
