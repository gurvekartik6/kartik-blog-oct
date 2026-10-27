import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Workspaces execute from their own folders; load the single repository-root .env explicitly.
const repositoryRootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../.env');
dotenv.config({ path: repositoryRootEnv });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:4000'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/personal_blog'),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(12),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default(''),
  CORS_ORIGINS: z.string().optional().default('http://localhost:5173')
});

export const env = schema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';

if (/replace_with|placeholder/i.test(env.SESSION_SECRET)) throw new Error('Replace the SESSION_SECRET placeholder with a random secret before starting the app.');
if (/replace_with|placeholder/i.test(env.ADMIN_PASSWORD)) throw new Error('Replace the ADMIN_PASSWORD placeholder before starting the app.');

// Fail closed in production instead of silently running with development secrets.
if (isProduction) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 || /replace_with|local-development|placeholder|change-this/i.test(process.env.SESSION_SECRET)) {
    throw new Error('Production requires SESSION_SECRET with at least 32 non-default characters.');
  }
  if (!process.env.ADMIN_EMAIL || /example\.com$/i.test(process.env.ADMIN_EMAIL) || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12 || /replace_with|local-development|placeholder|change-this/i.test(process.env.ADMIN_PASSWORD)) {
    throw new Error('Production requires ADMIN_EMAIL and a non-placeholder ADMIN_PASSWORD (12+ characters) for administrator provisioning.');
  }
  if (!process.env.MONGODB_URI || !process.env.REDIS_URL) {
    throw new Error('Production requires explicit MONGODB_URI and REDIS_URL values.');
  }
  if (!/^https:\/\//i.test(env.CLIENT_URL) || !/^https:\/\//i.test(env.API_URL)) {
    throw new Error('Production CLIENT_URL and API_URL must use HTTPS.');
  }
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || /example\.com/i.test(env.EMAIL_FROM)) {
    throw new Error('Production requires RESEND_API_KEY and EMAIL_FROM on a verified, non-placeholder sender domain.');
  }
}

