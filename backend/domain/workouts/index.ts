import { repositoryUser } from "../user";
import { WorkoutsHandler } from "./handlers/WorkoutsHandler";

export const workoutsHandler = new WorkoutsHandler(repositoryUser);
