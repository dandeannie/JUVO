import { Router } from 'express';
import db from '../lib/db.js';
import { authMiddleware, requireUser } from '../lib/auth.js';

export const router = Router();

// Create booking (member) - supports custom services
router.post('/', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const user = req.user;
    if (user.accountType !== 'member') return res.status(403).json({ error: 'only_members' });
    
    const { serviceId, customServiceTitle, customServiceDescription, location, offeredPrice_cents, scheduled_at } = req.body || {};
    
    if (!serviceId && !customServiceTitle) {
      return res.status(400).json({ error: 'service_or_custom_required' });
    }
    
    // If serviceId provided, verify it exists
    if (serviceId) {
    const svc = await db.Service.findByPk(serviceId);
    if (!svc) return res.status(404).json({ error: 'service_not_found' });
    }
    
    const booking = await db.Booking.create({
      serviceId: serviceId || null,
      customServiceTitle,
      customServiceDescription,
      memberId: user.id,
      helperId: serviceId ? (await db.Service.findByPk(serviceId)).providerId : null,
      location,
      offeredPrice_cents,
      scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
      status: 'pending'
    });
    
    res.status(201).json(booking);
  } catch (e) {
    console.error('bookings:create', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Get bookings for current user
router.get('/mine', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const user = req.user;
    const where = user.accountType === 'member' ? { memberId: user.id } : { helperId: user.id };
    const list = await db.Booking.findAll({ where, include: [{ model: db.Service, as: 'service' }], limit: 500, order: [['createdAt','DESC']] });
    res.json(list);
  } catch (e) {
    console.error('bookings:mine', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Get available requests for helpers (by location)
router.get('/available', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const user = req.user;
    
    if (user.accountType === 'member') {
      return res.status(403).json({ error: 'helpers_only' });
    }
    
    // Get requests pending acceptance
    const where = { status: ['pending', 'counter_offered'] };
    
    const list = await db.Booking.findAll({
      where,
      include: [
        { model: db.Service, as: 'service' },
        { model: db.User, as: 'member', attributes: ['id', 'username', 'email'] }
      ],
      limit: 100,
      order: [['createdAt', 'DESC']]
    });
    
    res.json(list);
  } catch (e) {
    console.error('bookings:available', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Update booking status or counter-offer
router.put('/:id', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const b = await db.Booking.findByPk(req.params.id);
    if (!b) return res.status(404).json({ error: 'not_found' });
    
    const user = req.user;
    const isHelper = ['helper', 'chef'].includes(user.accountType);
    const isMember = user.accountType === 'member';
    
    const { status, counterOffer_cents, scheduled_at, agreeToCounter } = req.body || {};
    
    // Helper actions
    if (isHelper) {
      if (status === 'accepted') {
        // Helper accepts the request
        b.status = 'accepted';
        b.helperId = user.id;
        b.agreedPrice_cents = b.offeredPrice_cents || counterOffer_cents;
      } else if (counterOffer_cents) {
        // Helper makes counter-offer
        b.status = 'counter_offered';
        b.counterOffer_cents = counterOffer_cents;
        b.helperId = user.id;
      } else if (status) {
        b.status = status;
      }
    }
    
    // Member actions
    if (isMember && b.memberId === user.id) {
      if (agreeToCounter && b.status === 'counter_offered') {
        // Member accepts counter-offer
        b.status = 'accepted';
        b.agreedPrice_cents = b.counterOffer_cents;
      } else if (status) {
        b.status = status;
      }
    }
    
    if (scheduled_at) b.scheduled_at = new Date(scheduled_at);
    
    await b.save();
    res.json(b);
  } catch (e) {
    console.error('bookings:update', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Accept request (helper)
router.post('/:id/accept', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const b = await db.Booking.findByPk(req.params.id);
    if (!b) return res.status(404).json({ error: 'not_found' });
    
    const user = req.user;
    if (!['helper', 'chef'].includes(user.accountType)) {
      return res.status(403).json({ error: 'helpers_only' });
    }
    
    if (b.status !== 'pending') {
      return res.status(400).json({ error: 'request_already_processed' });
    }
    
    // Check if helper profile is completed
    if (!user.profileCompleted) {
      return res.status(400).json({ 
        error: 'profile_incomplete', 
        message: 'Please complete your profile before accepting jobs' 
      });
    }
    
    // Check if helper is verified
    if (!user.isVerified) {
      return res.status(400).json({ 
        error: 'account_not_verified', 
        message: 'Your account must be verified by admin before accepting jobs' 
      });
    }
    
    // Check schedule availability
    if (b.scheduled_at) {
      const scheduledDate = new Date(b.scheduled_at);
      const existingSchedule = await db.Schedule.findOne({
        where: {
          workerId: user.id,
          date: scheduledDate.toISOString().split('T')[0],
          isAvailable: false
        }
      });
      
      if (existingSchedule) {
        return res.status(400).json({ 
          error: 'schedule_conflict', 
          message: 'This time slot is already booked in your schedule' 
        });
      }
    }
    
    // Accept the request
    b.status = 'accepted';
    b.helperId = user.id;
    b.agreedPrice_cents = b.offeredPrice_cents;
    await b.save();
    
    // Create schedule entry if scheduled
    if (b.scheduled_at) {
      const scheduledDate = new Date(b.scheduled_at);
      await db.Schedule.create({
        workerId: user.id,
        date: scheduledDate.toISOString().split('T')[0],
        startTime: scheduledDate.toTimeString().split(' ')[0].substring(0, 5),
        endTime: new Date(scheduledDate.getTime() + 2 * 60 * 60 * 1000).toTimeString().split(' ')[0].substring(0, 5),
        isAvailable: false,
        bookingId: b.id
      });
    }
    
    res.json(b);
  } catch (e) {
    console.error('bookings:accept', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Counter offer (helper)
router.post('/:id/counter-offer', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const b = await db.Booking.findByPk(req.params.id);
    if (!b) return res.status(404).json({ error: 'not_found' });
    
    const user = req.user;
    if (!['helper', 'chef'].includes(user.accountType)) {
      return res.status(403).json({ error: 'helpers_only' });
    }
    
    const { counterOffer_cents } = req.body || {};
    if (!counterOffer_cents || counterOffer_cents <= 0) {
      return res.status(400).json({ error: 'invalid_counter_offer' });
    }
    
    if (b.status !== 'pending') {
      return res.status(400).json({ error: 'request_already_processed' });
    }
    
    // Make counter offer
    b.status = 'counter_offered';
    b.helperId = user.id;
    b.counterOffer_cents = counterOffer_cents;
    await b.save();
    
    res.json(b);
  } catch (e) {
    console.error('bookings:counter-offer', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Accept counter offer (member)
router.post('/:id/accept-counter', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const b = await db.Booking.findByPk(req.params.id);
    if (!b) return res.status(404).json({ error: 'not_found' });
    
    const user = req.user;
    if (user.accountType !== 'member' || b.memberId !== user.id) {
      return res.status(403).json({ error: 'not_authorized' });
    }
    
    if (b.status !== 'counter_offered') {
      return res.status(400).json({ error: 'no_counter_offer' });
    }
    
    // Accept counter offer
    b.status = 'accepted';
    b.agreedPrice_cents = b.counterOffer_cents;
    await b.save();
    
    res.json(b);
  } catch (e) {
    console.error('bookings:accept-counter', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Complete service and process payment
// Start job (helper)
router.post('/:id/start', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const b = await db.Booking.findByPk(req.params.id);
    if (!b) return res.status(404).json({ error: 'not_found' });
    
    const user = req.user;
    const isHelper = ['helper', 'chef'].includes(user.accountType) && b.helperId === user.id;
    
    if (!isHelper) return res.status(403).json({ error: 'not_authorized' });
    
    if (b.status !== 'accepted') {
      return res.status(400).json({ error: 'booking_not_accepted' });
    }
    
    // Start the job
    b.status = 'in_progress';
    await b.save();
    
    res.json({ message: 'Job started successfully', booking: b });
  } catch (e) {
    console.error('bookings:start', e);
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/:id/complete', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const b = await db.Booking.findByPk(req.params.id);
    if (!b) return res.status(404).json({ error: 'not_found' });
    
    const user = req.user;
    const isHelper = ['helper', 'chef'].includes(user.accountType) && b.helperId === user.id;
    
    if (!isHelper) return res.status(403).json({ error: 'not_authorized' });
    
    if (!['accepted', 'in_progress'].includes(b.status)) {
      return res.status(400).json({ error: 'booking_not_ready_for_completion' });
    }
    
    // Mark as completed
    b.status = 'completed';
    await b.save();
    
    // Record payment
    const payment = await db.Payment.create({
      bookingId: b.id,
      amount_cents: b.agreedPrice_cents || b.offeredPrice_cents,
      provider: 'stripe',
      status: 'paid',
      metadata: { completed_by: user.id }
    });
    
    // Create earnings record
    await db.Earnings.create({
      workerId: user.id,
      bookingId: b.id,
      amount_cents: b.agreedPrice_cents || b.offeredPrice_cents,
      status: 'pending'
    });
    
    // Update schedule to free slot
    if (b.scheduled_at) {
      const scheduledDate = new Date(b.scheduled_at);
      await db.Schedule.update(
        { isAvailable: true, bookingId: null },
        {
          where: {
            workerId: user.id,
            date: scheduledDate.toISOString().split('T')[0],
            bookingId: b.id
          }
        }
      );
    }
    
    res.json({ message: 'Job completed successfully', booking: b, payment });
  } catch (e) {
    console.error('bookings:complete', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Confirm payment for a booking (member after Payment.html)
router.post('/:id/confirm-payment', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const b = await db.Booking.findByPk(req.params.id);
    if (!b) return res.status(404).json({ error: 'not_found' });
    
    const user = req.user;
    if (user.accountType !== 'member' || b.memberId !== user.id) {
      return res.status(403).json({ error: 'not_authorized' });
    }
    
    const { paymentId, amount_cents, provider } = req.body || {};
    
    // Create payment record
    const payment = await db.Payment.create({
      bookingId: b.id,
      amount_cents: amount_cents || b.agreedPrice_cents || b.offeredPrice_cents,
      provider: provider || 'razorpay',
      status: 'paid',
      transactionId: paymentId,
      metadata: { paid_by: user.id, paid_at: new Date() }
    });
    
    // Update booking status to paid
    b.status = 'paid';
    await b.save();
    
    res.json({ message: 'Payment confirmed successfully', booking: b, payment });
  } catch (e) {
    console.error('bookings:confirm-payment', e);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
