import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../infrastructure/errors';
import { logger } from '../../infrastructure/logger';

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction,
): void {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            message: err.message,
            data: null,
            ...(err.errors && err.errors.length > 0 ? { errors: err.errors } : {}),
        });
        return;
    }

    // Unexpected / unhandled errors
    logger.error({
        err: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
    });

    res.status(500).json({
        message:
            process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : err.message,
        data: null,
    });
}

export function notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
        message: `Route ${req.method} ${req.url} not found`,
        data: null,
    });
}
