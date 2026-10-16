import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/netshare_db';

const main = async () => {
  const email = 'client@netshare.io';
  const password = 'Password123!';
  const name = 'Alex Morgan';

  try {
    await mongoose.connect(MONGO_URI);
    const User = (await import('../models/User.js')).default;
    const Wallet = (await import('../models/Wallet.js')).default;

    let client = await User.findOne({ email: email.toLowerCase() });
    const hashedPassword = await bcrypt.hash(password, 10);

    if (!client) {
      client = await User.create({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'platform_client',
        isVerified: true,
        status: 'active',
      });
      await Wallet.create({
        userId: client._id,
        balance: 450,
        spentCredits: 80,
      });
      console.log('Created test client:', client.email);
    } else {
      client.password = hashedPassword;
      client.isVerified = true;
      client.status = 'active';
      client.role = 'platform_client';
      await client.save();

      let wallet = await Wallet.findOne({ userId: client._id });
      if (!wallet) {
        wallet = await Wallet.create({
          userId: client._id,
          balance: 450,
          spentCredits: 80,
        });
      } else if (wallet.balance < 50) {
        wallet.balance = 450;
        wallet.spentCredits = 80;
        await wallet.save();
      }
      console.log('Updated test client:', client.email);
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Failed to create/update test client:', err.message);
    process.exit(1);
  }
};

main();
