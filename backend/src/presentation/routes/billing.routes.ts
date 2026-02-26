import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getCheckoutUrl, handleStripeWebhook } from '../../application/use-cases/billing/billing.use-cases';
import { AppError } from '../../infrastructure/errors';

const router = Router();

// POST /api/v1/billing/create-checkout
router.post('/create-checkout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { billingCycle } = req.body;
        if (!['MONTHLY', 'ANNUAL'].includes(billingCycle)) {
            throw new AppError('billingCycle must be MONTHLY or ANNUAL', 400);
        }
        const url = getCheckoutUrl(billingCycle as 'MONTHLY' | 'ANNUAL', req.user?.email);
        res.json({ message: 'Checkout URL generated', data: { url } });
    } catch (err) {
        next(err);
    }
});

// POST /api/v1/billing/webhook — raw body required for Stripe signature
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const signature = req.headers['stripe-signature'] as string;
        if (!signature) {
            throw new AppError('Missing Stripe signature header', 400);
        }
        await handleStripeWebhook(req.body as Buffer, signature);
        res.json({ received: true });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

export default router;
