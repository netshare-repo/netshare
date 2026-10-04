#!/usr/bin/env node
/**
 * Admin Bootstrap Script
 * Usage: node scripts/createAdmin.js --email admin@netshare.io --password StrongPass1 [--name "Admin"]
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/netshare_db';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    parsed[key] = args[i + 1];
  }
  return parsed;
};

const main = async () => {
  const { email, password, name } = parseArgs();
  
  if (!email || !password) {
    console.error('Usage: node scripts/createAdmin.js --email <email> --password <password> [--name <name>]');
    process.exit(1);
  }
  
  // Validate password strength
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    console.error('ERROR: Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number.');
    process.exit(1);
  }
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to MongoDB: ${MONGO_URI.replace(/\/\/.*@/, '//***@')}`);
    
    const User = (await import('../models/User.js')).default;
    const Wallet = (await import('../models/Wallet.js')).default;
    
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.error(`ERROR: User with email ${email} already exists.`);
      process.exit(1);
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const admin = await User.create({
      name: name || 'Admin',
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
      isVerified: true,
      status: 'active',
    });
    
    await Wallet.create({
      userId: admin._id,
      balance: 0,
    });
    
    console.log(`\nAdmin account created successfully:`);
    console.log(`  ID:    ${admin._id}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role:  ${admin.role}`);
    console.log(`\nPassword was NOT logged for security.`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Failed to create admin:', err.message);
    process.exit(1);
  }
};

main();
