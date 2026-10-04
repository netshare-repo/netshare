import mongoose from 'mongoose';
import config from './env.js';
import logger from '../lib/logger.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri);
    logger.info({ host: conn.connection.host, name: conn.connection.name }, 'MongoDB connected');
  } catch (error) {
    logger.fatal({ err: error }, 'MongoDB connection failed');
    process.exit(1);
  }
};

export default connectDB;