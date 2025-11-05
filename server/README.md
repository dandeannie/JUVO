# JUVO Server (Node + Express)

## Prereqs
- Node 18+

## Setup (Windows)
1. Copy `.env.example` to `.env` if needed.
2. Install deps:
   ```powershell
   cd server
   npm install
   ```
3. Start server:
   ```powershell
   npm run dev
   ```
   The API runs at `http://localhost:4000`.

## API
- `GET /health` → `{ ok: true }`
- `POST /auth/signup` → `{ id }`  body: `{ email?, phone?, password }`
- `POST /auth/login` → `{ id }`   body: `{ email?, phone?, password }`

## Connecting the frontend
Update your login submit handler to `fetch('http://localhost:4000/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, phone, password }) })`.

## Payments (placeholder)
- `GET /payments/config` → `{ provider: 'stripe', ready: boolean }`
- When you are ready, add your Stripe keys to `.env` and implement charges or subscriptions in `src/routes/payments.js`.

## Notes
- Uses SQLite database (stored in `server/data/juvo.db`) for persistent data storage.
- Passwords are stored as bcrypt hashes.
- Email or phone can be used (both unique).
- JWT-based authentication with refresh tokens.
- Security features: Helmet, CORS, rate limiting, cookie parser.
- For production, update JWT_SECRET and Razorpay keys in `.env` and enable HTTPS.