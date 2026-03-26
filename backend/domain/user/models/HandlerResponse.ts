export interface HandlerResponse<T = unknown> {
  status: number;
  message?: string;
  data?: T;
}
