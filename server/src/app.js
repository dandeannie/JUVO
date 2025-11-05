import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { router as authRouter } from './routes/auth.js';
import { router as servicesRouter } from './routes/services.js';
import { router as bookingsRouter } from './routes/bookings.js';
import { router as paymentsRouter } from './routes/payments.js';
import { router as adminRouter } from './routes/admin.js';
import { router as contactRouter } from './routes/contact.js';
import dbLib from './lib/db.js';

if (!process.env.ADMIN_SECRET) {
  process.env.ADMIN_SECRET = 'admin123';
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', '..');

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com', 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          imgSrc: [
            "'self'",
            'data:',
            'https://maps.gstatic.com',
            'https://maps.googleapis.com',
            'https://lh5.googleusercontent.com'
          ],
          connectSrc: [
            "'self'",
            'http://localhost:4000',
            'https://maps.googleapis.com'
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          frameSrc: [
            "'self'",
            'https://www.google.com',
            'https://maps.google.com'
          ],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
    })
  );
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  app.use(express.static(publicDir));

  app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.get('/health', (req, res) => {
    (async function () {
      let dbOk = false;
      let dbErr = null;
      try {
        await dbLib.initDB();
        dbOk = true;
      } catch (e) {
        dbErr = e && e.message;
      }
      res.json({ ok: true, db: dbOk ? 'connected' : 'disconnected', dbError: dbErr });
    })();
  });

  app.use('/auth', authRouter);
  app.use('/services', servicesRouter);
  app.use('/bookings', bookingsRouter);
  app.use('/payments', paymentsRouter);
  app.use('/contact', contactRouter);

  const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
  app.use('/admin', adminLimiter, adminRouter);

  return app;
}

const app = createApp();
export default app;
