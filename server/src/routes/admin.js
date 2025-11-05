import { Router } from 'express';
import { Op } from 'sequelize';
import db from '../lib/db.js';

export const router = Router();

function checkAdmin(req, res, next){
  const s = req.headers['x-admin-secret'] || '';
  if (!process.env.ADMIN_SECRET || s !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'unauthorized' });
  next();
}

function toId(value) {
  if (value == null) return value;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? value : numeric;
}

function sanitizeUser(u){
  return {
    id: toId(u.id),
    email: u.email || null,
    phone: u.phone || null,
    username: u.username || null,
    accountType: u.accountType || null,
    avatarUrl: u.avatarUrl || null,
    isVerified: u.isVerified || false,
    created_at: u.createdAt || null
  };
}

router.get('/users', checkAdmin, async (req, res) => {
  try {
    await db.initDB();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const skip = (page - 1) * limit;
    const users = await db.User.findAll({ offset: skip, limit, order: [['createdAt','DESC']] });
    const safe = users.map(sanitizeUser);
    res.json({ page, limit, users: safe });
  } catch (e) { console.error('admin/users', e); res.status(500).json({ error: 'server_error' }); }
});

router.get('/bookings', checkAdmin, async (req, res) => {
  try {
    await db.initDB();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '100', 10)));
    const skip = (page - 1) * limit;
    const q = {};
    if (req.query.status) q.status = req.query.status;
    const b = await db.Booking.findAll({ where: q, include: [{ model: db.Service, as: 'service' }], offset: skip, limit, order: [['createdAt','DESC']] });
    const out = b.map(item => ({
      id: toId(item.id),
      service: item.service ? { id: toId(item.service.id), title: item.service.title } : (item.customServiceTitle ? { id: null, title: item.customServiceTitle } : null),
      memberId: toId(item.memberId),
      helperId: toId(item.helperId),
      scheduled_at: item.scheduled_at || null,
      status: item.status || null,
      created_at: item.createdAt || null,
      customServiceTitle: item.customServiceTitle || null,
      offeredPrice_cents: item.offeredPrice_cents ?? null,
      counterOffer_cents: item.counterOffer_cents ?? null,
      agreedPrice_cents: item.agreedPrice_cents ?? null
    }));
    res.json({ page, limit, bookings: out });
  } catch (e) { console.error('admin/bookings', e); res.status(500).json({ error: 'server_error' }); }
});

// Get workers for verification
router.get('/workers', checkAdmin, async (req, res) => {
  try {
    await db.initDB();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const skip = (page - 1) * limit;
    const workers = await db.User.findAll({
      where: { accountType: { [Op.in]: ['helper', 'chef'] } },
      offset: skip,
      limit,
      order: [['createdAt','DESC']]
    });
    const safe = workers.map(sanitizeUser);
    res.json({ page, limit, workers: safe });
  } catch (e) { console.error('admin/workers', e); res.status(500).json({ error: 'server_error' }); }
});

// Verify or reject a worker
router.post('/workers/:id/verify', checkAdmin, async (req, res) => {
  try {
    await db.initDB();
    const { id } = req.params;
    const { verified } = req.body;

    const worker = await db.User.findByPk(id);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    if (!['helper', 'chef'].includes(worker.accountType)) {
      return res.status(400).json({ error: 'User is not a worker' });
    }

    await worker.update({ isVerified: verified });

    res.json({ 
      message: `Worker ${verified ? 'verified' : 'rejected'} successfully`,
      worker: sanitizeUser(worker)
    });
  } catch (e) { 
    console.error('admin/workers/verify', e); 
    res.status(500).json({ error: 'server_error' }); 
  }
});

router.get('/finance', checkAdmin, async (req, res) => {
  try {
    await db.initDB();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalRevenue,
      revenueLast30,
      pendingRevenue,
      pendingPaymentsCount,
      payoutsPaid,
      paidPayoutsCount,
      payoutsPending,
      pendingPayoutsCount,
      payments,
      earnings
    ] = await Promise.all([
      db.Payment.sum('amount_cents', { where: { status: 'paid' } }),
      db.Payment.sum('amount_cents', { where: { status: 'paid', createdAt: { [Op.gte]: thirtyDaysAgo } } }),
      db.Payment.sum('amount_cents', { where: { status: 'pending' } }),
      db.Payment.count({ where: { status: 'pending' } }),
      db.Earnings.sum('amount_cents', { where: { status: 'paid' } }),
      db.Earnings.count({ where: { status: 'paid' } }),
      db.Earnings.sum('amount_cents', { where: { status: 'pending' } }),
      db.Earnings.count({ where: { status: 'pending' } }),
      db.Payment.findAll({
        limit: 25,
        order: [['createdAt', 'DESC']],
        include: [{ model: db.Booking, as: 'booking', attributes: ['id', 'memberId', 'helperId', 'status'] }]
      }),
      db.Earnings.findAll({
        limit: 25,
        order: [['createdAt', 'DESC']],
        include: [{ model: db.User, as: 'worker', attributes: ['id', 'username', 'email'] }]
      })
    ]);

    const paymentRows = (payments || []).map(item => ({
      id: toId(item.id),
      bookingId: toId(item.bookingId),
      amount_cents: item.amount_cents || 0,
      status: item.status || 'pending',
      created_at: item.createdAt || null,
      booking: item.booking
        ? {
            id: toId(item.booking.id),
            memberId: toId(item.booking.memberId),
            helperId: toId(item.booking.helperId),
            status: item.booking.status || null
          }
        : null
    }));

    const earningRows = (earnings || []).map(item => ({
      id: toId(item.id),
      bookingId: toId(item.bookingId),
      workerId: toId(item.workerId),
      amount_cents: item.amount_cents || 0,
      status: item.status || 'pending',
      payoutDate: item.payoutDate || null,
      created_at: item.createdAt || null,
      worker: item.worker
        ? {
            id: toId(item.worker.id),
            username: item.worker.username || null,
            email: item.worker.email || null
          }
        : null
    }));

    res.json({
      summary: {
        totalRevenue_cents: totalRevenue || 0,
        revenueLast30_cents: revenueLast30 || 0,
        pendingRevenue_cents: pendingRevenue || 0,
        pendingPaymentsCount: pendingPaymentsCount || 0,
        payoutsPaid_cents: payoutsPaid || 0,
        paidPayoutsCount: paidPayoutsCount || 0,
        payoutsPending_cents: payoutsPending || 0,
        pendingPayoutsCount: pendingPayoutsCount || 0
      },
      payments: paymentRows,
      earnings: earningRows
    });
  } catch (e) {
    console.error('admin/finance', e);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;

