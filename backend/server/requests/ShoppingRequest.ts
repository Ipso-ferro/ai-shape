export interface ShoppingItemRouteParams {
  id: string;
  itemId: string;
}

export interface ToggleShoppingItemRequestBody {
  checked?: boolean;
  dietType?: "recipes" | "single-food";
  week?: "current" | "next";
}
