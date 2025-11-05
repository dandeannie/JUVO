import { Router } from 'express';
import Stripe from 'stripe';
import db from '../lib/db.js';
import { authMiddleware, requireUser } from '../lib/auth.js';

export const router = Router();

router.get('/config', (req, res) => {
  const ready = Boolean(process.env.STRIPE_SECRET_KEY);
  res.json({ provider: 'stripe', ready });
});

router.post('/create-checkout-session', async (req, res) => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(500).json({ error: 'stripe_not_configured' });
    const stripe = new Stripe(stripeKey);
    const { plan } = req.body || {};
    const price = plan === 'yearly' ? 499900 : 49900;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price_data: { currency: 'inr', product_data: { name: plan === 'yearly' ? 'JUVO+ (Yearly)' : 'JUVO+ (Monthly)' }, unit_amount: price }, quantity: 1 }],
      success_url: (process.env.PUBLIC_BASE_URL || 'http://localhost:4000') + '/member.html?plus=success',
      cancel_url: (process.env.PUBLIC_BASE_URL || 'http://localhost:4000') + '/member.html?plus=cancel'
    });
    res.json({ id: session.id, url: session.url });
  } catch (e) { console.error('payments:create', e); res.status(500).json({ error: 'server_error', message: e.message }); }
});

router.post('/record', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const { bookingId, amount_cents, provider } = req.body || {};
    if (!bookingId || !amount_cents) return res.status(400).json({ error: 'booking_and_amount_required' });
    const p = await db.Payment.create({ bookingId, amount_cents, provider: provider || 'stripe', status: 'paid', metadata: req.body.metadata || {} });
    res.status(201).json(p);
  } catch (e) { console.error('payments:record', e); res.status(500).json({ error: 'server_error' }); }
});

export default router;
