import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { inviteCodeRepository } from '../../infrastructure/repositories';
import { NotFoundError, AppError } from '../../infrastructure/errors';

const router = Router();

// GET /api/v1/invites
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const codes = await inviteCodeRepository.findByCoachId(req.user!.userId);
        res.json({ message: 'Invite codes fetched', data: codes });
    } catch (err) {
        next(err);
    }
});

// POST /api/v1/invites/generate
router.post('/generate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const invite = await inviteCodeRepository.create({
            coachId: req.user!.userId,
            code,
            expiresAt,
        });
        res.status(201).json({ message: 'Invite code generated', data: invite });
    } catch (err) {
        next(err);
    }
});

const RedeemSchema = z.object({
    body: z.object({ code: z.string().min(1) }),
});

// POST /api/v1/invites/redeem
router.post('/redeem', authenticate, validate(RedeemSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const invite = await inviteCodeRepository.findByCode(req.body.code);
        if (!invite) throw new NotFoundError('Invite code not found');
        if (invite.usedByUserId) throw new AppError('Invite code already used', 409);
        if (new Date() > invite.expiresAt) throw new AppError('Invite code has expired', 410);

        const redeemed = await inviteCodeRepository.redeem(invite.id, req.user!.userId);
        res.json({ message: 'Invite code redeemed', data: redeemed });
    } catch (err) {
        next(err);
    }
});

export default router;
