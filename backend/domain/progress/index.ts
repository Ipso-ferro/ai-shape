import { repositoryUser } from "../user";
import { ProgressHandler } from "./handlers/ProgressHandler";

export const progressHandler = new ProgressHandler(repositoryUser);
