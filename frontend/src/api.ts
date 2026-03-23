import {
  AuthSession,
  CompletePlanResult,
  CreateUserResponse,
  DietPlan,
  DietType,
  ProgressDay,
  ProgressSummary,
  ShoppingList,
  UserProfile,
  WorkoutPlan,
} from "./types";

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

const buildUrl = (path: string): string => `${apiBaseUrl}${path}`;

let accessToken: string | null = null;

const unauthorizedEventName = "ai-shape:unauthorized";

const dispatchUnauthorized = (message: string) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(unauthorizedEventName, {
      detail: { message },
    }));
  }
};

const request = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(buildUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === "string"
      ? payload
      : payload?.message ?? "Request failed";

    if (response.status === 401 && accessToken) {
      dispatchUnauthorized(message);
    }

    throw new ApiError(message, response.status);
  }

  return payload as T;
};

const optional = async <T>(path: string): Promise<T | null> => {
  try {
    return await request<T>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
};

export const api = {
  setAccessToken: (token: string | null) => {
    accessToken = token;
  },
  clearAccessToken: () => {
    accessToken = null;
  },
  getUnauthorizedEventName: () => unauthorizedEventName,
  register: (email: string, password: string) => request<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }),
  login: (email: string, password: string) => request<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }),
  googleAuth: (idToken: string) => request<AuthSession>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  }),
  getSession: () => request<AuthSession>("/auth/session"),
  createUser: (email: string, password: string) => request<CreateUserResponse>("/users", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }),
  getUser: (userId: string) => request<UserProfile>(`/users/${userId}`),
  saveUser: (userId: string, payload: object) => request<{ message: string }>(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }),
  generateCompletePlan: (userId: string, dietType: DietType) => request<CompletePlanResult>(`/users/${userId}/complete-plan`, {
    method: "POST",
    body: JSON.stringify({ dietType }),
  }),
  getDietPlan: (userId: string) => optional<DietPlan>(`/diets/users/${userId}/plan`),
  getWorkoutPlan: (userId: string) => optional<WorkoutPlan>(`/workouts/users/${userId}/plan`),
  getShoppingList: (userId: string) => optional<ShoppingList>(`/shopping/users/${userId}/list`),
  getProgressDay: (userId: string, date: string) => request<ProgressDay>(`/progress/users/${userId}/day?date=${date}`),
  getProgressSummary: (userId: string, period: "month" | "year" | "day", date: string) => request<ProgressSummary>(`/progress/users/${userId}/summary?period=${period}&date=${date}`),
  toggleMeal: (
    userId: string,
    mealSlot: string,
    date: string,
    completed: boolean,
  ) => request<ProgressDay>(`/progress/users/${userId}/meals/${mealSlot}`, {
    method: "PUT",
    body: JSON.stringify({ date, completed }),
  }),
  toggleWorkout: (
    userId: string,
    date: string,
    completed: boolean,
  ) => request<ProgressDay>(`/progress/users/${userId}/workout`, {
    method: "PUT",
    body: JSON.stringify({ date, completed }),
  }),
  toggleShoppingItem: (
    userId: string,
    itemId: string,
    checked: boolean,
  ) => request<ShoppingList>(`/shopping/users/${userId}/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    body: JSON.stringify({ checked }),
  }),
};

export { ApiError };
