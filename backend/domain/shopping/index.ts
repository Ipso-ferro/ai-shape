import { repositoryUser } from "../user";
import { ShoppingListHandler } from "./handlers/ShoppingListHandler";

export const shoppingListHandler = new ShoppingListHandler(repositoryUser);
