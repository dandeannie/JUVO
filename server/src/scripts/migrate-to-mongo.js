import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dbLib from '../lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function migrate(){
  const dataPath = path.join(__dirname, '..', '..', 'data', 'juvo.json');
  if (!fs.existsSync(dataPath)) { console.log('No juvo.json found, nothing to migrate'); return; }
  const raw = fs.readFileSync(dataPath, 'utf8');
  let parsed = {};
  try { parsed = JSON.parse(raw); } catch (e) { console.error('invalid juvo.json', e); return; }
  const users = parsed.users || [];
  if (!users.length) { console.log('No users to migrate'); return; }

  await dbLib.initDB();
  await dbLib.ensureIndexes();

  for (const u of users){
    try {
      // check existing by email/phone
      const exists = u.email ? await dbLib.User.findOne({ email: u.email }) : (u.phone ? await dbLib.User.findOne({ phone: u.phone }) : null);
      if (exists) { console.log('Skipping existing user', u.email || u.phone); continue; }
      const doc = new dbLib.User({ email: u.email || null, phone: u.phone || null, username: u.username || null, address: u.address || null, accountType: u.accountType || 'member', password_hash: u.password_hash || u.password || 'UNAVAILABLE', created_at: u.created_at ? new Date(u.created_at) : new Date() });
      await doc.save();
      console.log('Migrated', doc._id.toString());
    } catch (e) { console.error('Error migrating user', u, e.message); }
  }
  console.log('Migration complete');
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });
