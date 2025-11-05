import bcrypt from 'bcryptjs';
import dbLib from '../src/lib/db.js';

async function resetPassword() {
  await dbLib.initDB();

  const email = process.env.RESET_EMAIL || 'dandnnie@gmail.com';
  const newPassword = process.env.NEW_PASSWORD || 'password123';

  const user = await dbLib.User.findOne({ where: { email } });
  if (!user) {
    console.log('User not found:', email);
    process.exit(1);
  }

  console.log('Found user:', { id: user.id, email: user.email, accountType: user.accountType });

  // Hash the new password
  const hash = await bcrypt.hash(newPassword, 10);
  
  // Update the user's password
  user.password_hash = hash;
  await user.save();

  console.log('Password updated successfully!');
  console.log('Login credentials:');
  console.log('  Email:', email);
  console.log('  Password:', newPassword);
  
  process.exit(0);
}

resetPassword().catch(e => { 
  console.error('Error:', e); 
  process.exit(1); 
});