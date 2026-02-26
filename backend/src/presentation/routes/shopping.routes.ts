import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { shoppingRepository } from '../../infrastructure/repositories';

const router = Router();

// GET /api/v1/shopping
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const items = await shoppingRepository.findByUserId(req.user!.userId);
        res.json({ message: 'Shopping list fetched', data: items });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/v1/shopping/:id/toggle
router.patch('/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { checked } = req.body;
        const item = await shoppingRepository.toggleChecked(req.params.id, Boolean(checked));
        res.json({ message: 'Item updated', data: item });
    } catch (err) {
        next(err);
    }
});

export default router;
