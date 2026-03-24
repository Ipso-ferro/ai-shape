import { RepositoryUser } from "../../user/repositories/RepositoryUser";

type DietType = "recipes" | "single-food";
type PlanWeek = "current" | "next";

interface ShoppingListOptions {
  dietType?: DietType;
  week?: PlanWeek;
}

export class ShoppingListHandler {
  constructor(private readonly repositoryUser: RepositoryUser) {}

  async getList(userId: string, _options?: ShoppingListOptions): Promise<unknown> {
    const user = await this.repositoryUser.getDataUser({ id: userId });
    return user;
  }

  async toggleItem(
    userId: string,
    _itemId: string,
    _checked: boolean,
    _options?: ShoppingListOptions,
  ): Promise<unknown> {
    const user = await this.repositoryUser.getDataUser({ id: userId });
    return user;
  }
}
