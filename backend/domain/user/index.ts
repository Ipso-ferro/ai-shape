import { UserHandler } from "./handlers/UserHandler";
import { UserPlanHandler } from "./handlers/UserPlanHandler";
import { MySqlRepositoryUser } from "./repositories/MySqlRepositoryUser";

export const repositoryUser = new MySqlRepositoryUser();
export const userHandler = new UserHandler(repositoryUser);
export const userPlanHandler = new UserPlanHandler(repositoryUser);
