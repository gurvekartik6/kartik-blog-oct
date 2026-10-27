
import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './config/env.js';

// Development workaround for the DNS issue on this machine.
// Configure DNS before any call to mongoose.connect().
dns.setServers(['8.8.8.8']);

mongoose.set('strictQuery', true);

let connectionPromise = null;

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing from the root .env file.');
  }

  connectionPromise = mongoose
    .connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 10000
    })
    .then(() => {
      console.log('MongoDB connected successfully.');
      return mongoose.connection;
    })
    .catch((error) => {
      console.error('MongoDB connection failed:', error.message);
      throw error;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
