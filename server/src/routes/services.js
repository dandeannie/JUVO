import { Router } from 'express';
import db from '../lib/db.js';
import { authMiddleware, requireUser } from '../lib/auth.js';

export const router = Router();

// List services (public)
router.get('/', async (req, res) => {
  try {
    await db.initDB();
    const list = await db.Service.findAll({ include: [{ model: db.User, as: 'provider', attributes: ['id','username','email','avatarUrl'] }], limit: 200 });
    res.json(list.map(s => ({ id: s.id, title: s.title, description: s.description, price_cents: s.price_cents, tags: s.tags || [], provider: s.provider ? { id: s.provider.id, username: s.provider.username, avatarUrl: s.provider.avatarUrl } : null, image: s.image || null })));
  } catch (e) { console.error('services:list', e); res.status(500).json({ error: 'server_error' }); }
});

// Get single service
router.get('/:id', async (req, res) => {
  try {
    await db.initDB();
    const s = await db.Service.findByPk(req.params.id, { include: [{ model: db.User, as: 'provider', attributes: ['id','username','email','avatarUrl'] }] });
    if (!s) return res.status(404).json({ error: 'not_found' });
    res.json({ id: s.id, title: s.title, description: s.description, price_cents: s.price_cents, tags: s.tags || [], provider: s.provider ? { id: s.provider.id, username: s.provider.username, avatarUrl: s.provider.avatarUrl } : null, image: s.image || null });
  } catch (e) { console.error('services:get', e); res.status(500).json({ error: 'server_error' }); }
});

// Create service (provider only)
router.post('/', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const user = req.user;
    if (!['helper','chef'].includes(user.accountType)) return res.status(403).json({ error: 'not_provider' });
    const { title, description, price_cents, tags, image } = req.body || {};
    const s = await db.Service.create({ title, description, price_cents: price_cents || 0, providerId: user.id, tags: tags || [], image: image || null });
    res.status(201).json({ id: s.id, title: s.title, description: s.description, price_cents: s.price_cents, tags: s.tags });
  } catch (e) { console.error('services:create', e); res.status(500).json({ error: 'server_error' }); }
});

// Update service (provider only)
router.put('/:id', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const s = await db.Service.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'not_found' });
    if (s.providerId !== req.user.id) return res.status(403).json({ error: 'not_owner' });
    const { title, description, price_cents, tags, image } = req.body || {};
    s.title = title || s.title; s.description = description || s.description; s.price_cents = price_cents != null ? price_cents : s.price_cents; s.tags = tags || s.tags; s.image = image || s.image;
    await s.save();
    res.json({ id: s.id, title: s.title, description: s.description, price_cents: s.price_cents, tags: s.tags });
  } catch (e) { console.error('services:update', e); res.status(500).json({ error: 'server_error' }); }
});

// Delete service
router.delete('/:id', authMiddleware, requireUser, async (req, res) => {
  try {
    await db.initDB();
    const s = await db.Service.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'not_found' });
    if (s.providerId !== req.user.id) return res.status(403).json({ error: 'not_owner' });
    await s.destroy();
    res.json({ ok: true });
  } catch (e) { console.error('services:delete', e); res.status(500).json({ error: 'server_error' }); }
});

export default router;

