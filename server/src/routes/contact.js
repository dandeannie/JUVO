import { Router } from 'express';
import db from '../lib/db.js';

export const router = Router();

function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'] || '';
  const expected = process.env.ADMIN_SECRET || 'admin123';
  if (secret !== expected) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// Submit contact form
router.post('/submit', async (req, res) => {
  try {
    await db.initDB();
    
    const { name, email, reason, message } = req.body;
    
    // Validate required fields
    if (!name || !email || !reason) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Name, email, and reason are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format'
      });
    }
    
    // Validate reason
    const validReasons = ['elder', 'errand', 'apply', 'chef', 'other'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ 
        error: 'Invalid reason selected'
      });
    }
    
    // Create contact record
    const contact = await db.Contact.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      reason,
      message: message ? message.trim() : null,
      status: 'new'
    });
    
    res.json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
      contactId: contact.id
    });
    
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({ 
      error: 'Failed to submit contact form',
      details: 'Please try again later'
    });
  }
});

// Get all contacts (admin only)
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    await db.initDB();
    
  const { page = 1, limit = 50, status } = req.query;
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
  const pageNum = Math.max(1, parseInt(page));
  const offset = (pageNum - 1) * limitNum;
    
    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    
    const contacts = await db.Contact.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset
    });
    
    const total = await db.Contact.count({ where: whereClause });
    
    res.json({
      contacts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
    
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Update contact status (admin only)
router.put('/admin/:id/status', requireAdmin, async (req, res) => {
  try {
    await db.initDB();
    
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['new', 'read', 'replied', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const contact = await db.Contact.findByPk(id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    await contact.update({ status });
    
    res.json({
      success: true,
      message: 'Contact status updated successfully',
      contact: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        status: contact.status
      }
    });
    
  } catch (error) {
    console.error('Error updating contact status:', error);
    res.status(500).json({ error: 'Failed to update contact status' });
  }
});

export default router;
