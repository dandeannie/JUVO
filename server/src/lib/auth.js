import jwt from 'jsonwebtoken';
import db from './db.js';

const AUTH_JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

export function authMiddleware(req, res, next){
  const auth = req.headers.authorization || '';
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'missing_token' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, AUTH_JWT_SECRET);
    req.auth = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

export async function requireUser(req, res, next){
  if (!req.auth) return res.status(401).json({ error: 'missing_auth' });
  await db.initDB();
  const user = await db.User.findByPk(req.auth.id);
  if (!user) return res.status(401).json({ error: 'user_not_found' });
  // attach plain object for convenience
  req.user = user;
  next();
}

export default { authMiddleware, requireUser };

