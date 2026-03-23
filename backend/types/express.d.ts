declare module "express" {
  export interface AuthenticatedRequestContext {
    userId: string;
    email: string;
    expiresAt: string;
  }

  export interface Request<
    Params = any,
    ResBody = any,
    ReqBody = any,
    ReqQuery = any,
  > {
    params: Params;
    body: ReqBody;
    query: ReqQuery;
    auth?: AuthenticatedRequestContext;
    headers: Record<string, string | string[] | undefined>;
  }

  export interface Response<ResBody = any> {
    status(code: number): Response<ResBody>;
    json(body: ResBody): Response<ResBody>;
  }

  export type NextFunction = (error?: unknown) => void;

  export interface Express {
    use(...args: any[]): void;
    get(...args: any[]): void;
    post(...args: any[]): void;
    put(...args: any[]): void;
    listen(port: number, callback?: () => void): any;
  }

  export interface Router {
    use(...args: any[]): Router;
    get(...args: any[]): Router;
    post(...args: any[]): Router;
    put(...args: any[]): Router;
  }

  interface ExpressStatic {
    (): Express;
    json(): any;
    Router(): Router;
  }

  const express: ExpressStatic;

  export function Router(): Router;

  export default express;
}
