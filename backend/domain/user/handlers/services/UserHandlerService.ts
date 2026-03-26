import { HandlerResponse } from "../../models/HandlerResponse";

export class UserHandlerService {
  success<T>(
    message: string,
    status = 200,
    data?: T,
  ): HandlerResponse<T> {
    return {
      status,
      message,
      data,
    };
  }
}
