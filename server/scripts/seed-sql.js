import bcrypt from 'bcryptjs';
import dbLib from '../src/lib/db.js';

async function run() {
  await dbLib.initDB();

  const email = process.env.SEED_EMAIL || 'test@local';
  const password = process.env.SEED_PASSWORD || 'password123';
  const username = process.env.SEED_USERNAME || 'testuser';

  const existing = await dbLib.User.findOne({ where: { email } });
  if (existing) {
    console.log('Seed user already exists:', existing.id, existing.email);
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await dbLib.User.create({
    email,
    username,
    accountType: 'member',
    password_hash: hash,
    refreshTokens: []
  });

  console.log('Seed user created:', { id: user.id, email: user.email, password });
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
