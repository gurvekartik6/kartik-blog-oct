
import dns from 'node:dns';
import bcrypt from 'bcryptjs';

import {
  connectDatabase,
  disconnectDatabase
} from '../db.js';

import { env } from '../config/env.js';
import { User } from '../models/index.js';

// Apply DNS settings before opening the MongoDB connection.
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function seedAdmin() {
  try {
    await connectDatabase();

    const email = env.ADMIN_EMAIL.toLowerCase().trim();

    const existing = await User.findOne({ email });

    if (existing) {
      console.log(
        `Admin ${email} already exists; no changes made.`
      );

      return;
    }

    const passwordHash = await bcrypt.hash(
      env.ADMIN_PASSWORD,
      12
    );

    await User.create({
      email,
      passwordHash,
      role: 'admin',
      active: true
    });

    console.log(`Admin created: ${email}`);
  } finally {
    await disconnectDatabase();
  }
}

try {
  await seedAdmin();
} catch (error) {
  console.error('Admin seeding failed:', error.message);
  process.exitCode = 1;
}
