import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { connectionRepository, userRepository } from '../../infrastructure/repositories';
import { NotFoundError } from '../../infrastructure/errors';

const router = Router();

// GET /api/v1/friends
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const connections = await connectionRepository.findByUserId(req.user!.userId);
        res.json({ message: 'Connections fetched', data: connections });
    } catch (err) {
        next(err);
    }
});

const RequestSchema = z.object({
    body: z.object({ email: z.string().email() }),
});

// POST /api/v1/friends/request
router.post('/request', authenticate, validate(RequestSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const target = await userRepository.findByEmail(req.body.email);
        if (!target) throw new NotFoundError('User not found');
        const connection = await connectionRepository.create(req.user!.userId, target.id);
        res.status(201).json({ message: 'Connection request sent', data: connection });
    } catch (err) {
        next(err);
    }
});

export default router;
