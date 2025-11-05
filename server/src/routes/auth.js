import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { Op } from 'sequelize';
import dbLib from '../lib/db.js';

export const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
const isProd = process.env.NODE_ENV === 'production';
const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 30
};
const clearRefreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/'
};

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function makeRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

// multer setup for avatar uploads — store in server/uploads and create dir if needed
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname is server/src/routes -> go up two levels to server
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
try { 
  fs.mkdirSync(uploadDir, { recursive: true }); 
} catch (e) { 
  console.warn('unable to create upload dir', e && e.message); 
}

const storage = multer.diskStorage({ 
  destination: (req, file, cb) => cb(null, uploadDir), 
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 4 } });

// Ensure DB connected
async function ready() {
  await dbLib.initDB();
  await dbLib.ensureIndexes();
}

function normalizeRefreshTokens(tokens) {
  if (!Array.isArray(tokens)) return [];
  return tokens.filter((entry) => entry && typeof entry.token === 'string');
}

async function attachRefreshToken(user, refreshToken) {
  const existing = normalizeRefreshTokens(user.refreshTokens).filter((entry) => entry.token !== refreshToken);
  const next = [...existing, { token: refreshToken, created_at: new Date().toISOString() }];
  const MAX_TOKENS = 5;
  user.refreshTokens = next.slice(-MAX_TOKENS);
  await user.save();
}

async function findUserByRefreshToken(refreshToken) {
  if (!refreshToken) return null;
  const candidates = await dbLib.User.findAll({
    where: {
      refreshTokens: {
        [Op.not]: null
      }
    }
  });
  return candidates.find((candidate) => {
    const list = normalizeRefreshTokens(candidate.refreshTokens);
    return list.some((entry) => entry.token === refreshToken);
  }) || null;
}

// Signup — persist to SQLite
router.post('/signup', async (req, res) => {
  try {
    await ready();
    const {
      email,
      phone,
      password,
      accountType,
      username,
      address,
      homeAddress,
      workAddress,
      city,
      location,
      dob
    } = req.body || {};
    
    if ((!email && !phone) || !password || !accountType) {
      return res.status(400).json({ error: 'email or phone, password and accountType required' });
    }
    
    // Check uniqueness
    if (email) {
      const exists = await dbLib.User.findOne({ where: { email } });
      if (exists) return res.status(409).json({ error: 'email_or_phone_exists' });
    }
    if (phone) {
      const exists = await dbLib.User.findOne({ where: { phone } });
      if (exists) return res.status(409).json({ error: 'email_or_phone_exists' });
    }
    
    const hash = await bcrypt.hash(password, 10);
    const user = await dbLib.User.create({
      email: email || null,
      phone: phone || null,
      username: username || null,
      address: address || null,
      homeAddress: homeAddress || null,
      workAddress: workAddress || null,
      location: location || city || null,
      accountType: accountType || 'member',
      password_hash: hash,
      refreshTokens: []
    });
    
    const token = signToken({ id: user.id, accountType: user.accountType });
    
    // Issue refresh token and persist
    const refreshToken = makeRefreshToken();
    await attachRefreshToken(user, refreshToken);
    
    // Set cookie (httpOnly)
    res.cookie('refreshToken', refreshToken, refreshCookieOptions);
    
    res.status(201).json({
      id: user.id,
      token,
      accountType: user.accountType,
      username: user.username,
      email: user.email,
      phone: user.phone,
      homeAddress: user.homeAddress,
      workAddress: user.workAddress,
      address: user.address,
      location: user.location
    });
  } catch (e) {
    console.error('signup error:', e);
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'duplicate_user' });
    }
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    await ready();
    const { email, phone, password } = req.body || {};
    
    if ((!email && !phone) || !password) {
      return res.status(400).json({ error: 'email or phone and password required' });
    }
    
    const user = email 
      ? await dbLib.User.findOne({ where: { email } })
      : await dbLib.User.findOne({ where: { phone } });
      
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });
    
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    
    const token = signToken({ id: user.id, accountType: user.accountType });
    
    // Create a refresh token for the session
    const refreshToken = makeRefreshToken();
    await attachRefreshToken(user, refreshToken);
    
    res.cookie('refreshToken', refreshToken, refreshCookieOptions);
    
    res.json({ 
      id: user.id, 
      token, 
      accountType: user.accountType,
      username: user.username,
      email: user.email,
      phone: user.phone
    });
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Refresh access token using a valid refresh token
router.post('/refresh', async (req, res) => {
  try {
    // Read refresh token from httpOnly cookie
    const refreshToken = req.cookies && req.cookies.refreshToken;
    if (!refreshToken) return res.status(400).json({ error: 'missing_refresh_token' });
    
    await ready();
    const user = await findUserByRefreshToken(refreshToken);
    
    if (!user) return res.status(401).json({ error: 'invalid_refresh' });
    
    // Issue new access token
    const token = signToken({ id: user.id, accountType: user.accountType });
    res.json({ token, id: user.id, accountType: user.accountType });
  } catch (e) { 
    console.error(e); 
    res.status(500).json({ error: 'server_error' }); 
  }
});

// Logout / revoke refresh token
router.post('/logout', async (req, res) => {
  try {
    // Read refresh token from cookie and revoke it server-side
    const refreshToken = req.cookies && req.cookies.refreshToken;
    if (!refreshToken) {
      // Clear cookie client-side as well
  res.clearCookie('refreshToken', clearRefreshCookieOptions);
      return res.status(200).json({ ok: true });
    }
    
    await ready();
    const user = await findUserByRefreshToken(refreshToken);
    
    if (user) {
      const tokens = normalizeRefreshTokens(user.refreshTokens).filter((entry) => entry.token !== refreshToken);
      user.refreshTokens = tokens;
      await user.save();
    }
    
    // Clear cookie
  res.clearCookie('refreshToken', clearRefreshCookieOptions);
    res.json({ ok: true });
  } catch (e) { 
    console.error(e); 
    res.status(500).json({ error: 'server_error' }); 
  }
});

// Me endpoint — returns basic user info when presented with Bearer token
router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'missing_token' });
    }
    
    const token = parts[1];
    let payload;
    try { 
      payload = jwt.verify(token, JWT_SECRET); 
    } catch (e) { 
      return res.status(401).json({ error: 'invalid_token' }); 
    }
    
    await ready();
    const user = await dbLib.User.findByPk(payload.id);
    if (!user) return res.status(404).json({ error: 'not_found' });
    
    const out = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      username: user.username || null,
      address: user.address || null,
      homeAddress: user.homeAddress || null,
      workAddress: user.workAddress || null,
      location: user.location || null,
      accountType: user.accountType,
      avatarUrl: user.avatarUrl || null,
      profileCompleted: !!user.profileCompleted,
      isVerified: !!user.isVerified,
      expertise: user.expertise || [],
      createdAt: user.createdAt
    };
    res.json(out);
  } catch (e) {
    console.error(e); 
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Update user profile
router.put('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'missing_token' });
    }
    
    const token = parts[1];
    let payload;
    try { 
      payload = jwt.verify(token, JWT_SECRET); 
    } catch (e) { 
      return res.status(401).json({ error: 'invalid_token' }); 
    }
    
    await ready();
    const user = await dbLib.User.findByPk(payload.id);
    if (!user) return res.status(404).json({ error: 'not_found' });
    
    const {
      username,
      email,
      phone,
      address,
      homeAddress,
      workAddress,
      location,
      profileCompleted,
      expertise,
      identityProof
    } = req.body || {};

    if (username !== undefined) user.username = username || null;
    if (email !== undefined) user.email = email || null;
    if (phone !== undefined) user.phone = phone || null;
    if (address !== undefined) user.address = address || null;
    if (homeAddress !== undefined) user.homeAddress = homeAddress || null;
    if (workAddress !== undefined) user.workAddress = workAddress || null;
    if (location !== undefined) user.location = location || null;
    if (profileCompleted !== undefined) user.profileCompleted = !!profileCompleted;
    if (Array.isArray(expertise)) user.expertise = expertise;
    if (identityProof !== undefined) user.identityProof = identityProof;
    
    await user.save();
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      address: user.address,
      homeAddress: user.homeAddress,
      workAddress: user.workAddress,
      location: user.location,
      accountType: user.accountType,
      avatarUrl: user.avatarUrl
    });
  } catch (e) {
    console.error('profile update error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Avatar upload for authenticated user — expects 'Authorization: Bearer <token>' and form-data field 'avatar'
router.post('/me/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'missing_token' });
    }
    
    const token = parts[1];
    let payload;
    try { 
      payload = jwt.verify(token, JWT_SECRET); 
    } catch (e) { 
      return res.status(401).json({ error: 'invalid_token' }); 
    }
    
    await ready();
    const user = await dbLib.User.findByPk(payload.id);
    if (!user) return res.status(404).json({ error: 'not_found' });
    
    if (!req.file) return res.status(400).json({ error: 'missing_file' });
    
    // Save public path relative to project root: /server/uploads/<name>
    const rel = path.posix.join('/server', 'uploads', path.basename(req.file.path));
    user.avatarUrl = rel;
    await user.save();
    
    res.json({ avatarUrl: rel });
  } catch (e) { 
    console.error('avatar upload error', e); 
    res.status(500).json({ error: 'server_error' }); 
  }
});