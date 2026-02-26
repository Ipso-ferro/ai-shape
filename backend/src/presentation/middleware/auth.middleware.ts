import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../../infrastructure/errors';

export interface JWTPayload {
    userId: string;
    email: string;
    isPro: boolean;
}

declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
        }
    }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
    try {
        // Support both cookie and Authorization header
        const token =
            req.cookies?.probody_token ||
            req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return next(new UnauthorizedError('No authentication token provided'));
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
        req.user = payload;
        next();
    } catch {
        next(new UnauthorizedError('Invalid or expired token'));
    }
}

export function requirePro(req: Request, _res: Response, next: NextFunction): void {
    if (!req.user?.isPro) {
        return next(new ForbiddenError('Pro subscription required to access this feature'));
    }
    next();
}
