import Stripe from 'stripe';
import { subscriptionRepository, userRepository } from '../../../infrastructure/repositories';
import { logger } from '../../../infrastructure/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-06-20',
});

export const STRIPE_PAYMENT_LINKS = {
    MONTHLY: process.env.STRIPE_MONTHLY_PRICE_LINK!,
    ANNUAL: process.env.STRIPE_ANNUAL_PRICE_LINK!,
};

// ─── Create Checkout Session ──────────────────────────────────────────────────

export function getCheckoutUrl(billingCycle: 'MONTHLY' | 'ANNUAL', userEmail?: string): string {
    const base = billingCycle === 'ANNUAL' ? STRIPE_PAYMENT_LINKS.ANNUAL : STRIPE_PAYMENT_LINKS.MONTHLY;
    if (userEmail) {
        return `${base}?prefilled_email=${encodeURIComponent(userEmail)}`;
    }
    return base;
}

// ─── Webhook Handler ──────────────────────────────────────────────────────────

export async function handleStripeWebhook(payload: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            payload,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!,
        );
    } catch (err: any) {
        logger.error({ err: err.message }, 'Stripe webhook signature verification failed');
        throw new Error('Webhook signature verification failed');
    }

    logger.info({ type: event.type }, 'Stripe webhook received');

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            const email = session.customer_details?.email;
            if (!email) break;

            const user = await userRepository.findByEmail(email);
            if (!user) {
                logger.warn({ email }, 'Stripe webhook: user not found');
                break;
            }

            const billingCycle = session.metadata?.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
            await userRepository.updatePro(user.id, true, 'PRO');
            await subscriptionRepository.upsert(user.id, {
                userId: user.id,
                tier: 'PRO',
                billingCycle,
                stripeCustomerId: session.customer as string ?? '',
                stripeSubscriptionId: session.subscription as string ?? '',
                startedAt: new Date(),
                endsAt: null,
                cancelledAt: null,
            });

            logger.info({ email, billingCycle }, 'User upgraded to Pro');
            break;
        }

        case 'customer.subscription.deleted': {
            const sub = event.data.object as Stripe.Subscription;
            const customer = await stripe.customers.retrieve(sub.customer as string);
            if ('deleted' in customer || !('email' in customer) || !customer.email) break;

            const user = await userRepository.findByEmail(customer.email);
            if (!user) break;

            await userRepository.updatePro(user.id, false, 'FREE');
            await subscriptionRepository.upsert(user.id, {
                userId: user.id,
                tier: 'FREE',
                billingCycle: 'MONTHLY',
                stripeCustomerId: sub.customer as string,
                stripeSubscriptionId: sub.id,
                startedAt: new Date(),
                endsAt: null,
                cancelledAt: new Date(),
            });

            logger.info({ email: customer.email }, 'User subscription cancelled, reverted to Free');
            break;
        }

        default:
            logger.debug({ type: event.type }, 'Unhandled Stripe event type');
    }
}
