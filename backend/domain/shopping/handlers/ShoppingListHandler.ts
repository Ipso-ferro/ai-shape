import { NotFoundError } from "../../share/Errors/AppErrors";
import { RepositoryUser } from "../../user/repositories/RepositoryUser";
import { ShoppingList } from "../../../src/types";

export class ShoppingListHandler {
  constructor(private readonly repositoryUser: RepositoryUser) {}

  async getList(userId: string): Promise<ShoppingList> {
    const shoppingList = await this.repositoryUser.getShoppingList(userId);

    if (!shoppingList) {
      throw new NotFoundError(`Shopping list for user "${userId}" was not found.`);
    }

    return shoppingList;
  }

  toggleItem(
    userId: string,
    itemId: string,
    checked: boolean,
  ): Promise<ShoppingList> {
    return this.repositoryUser.toggleShoppingListItem(userId, itemId, checked);
  }
}
