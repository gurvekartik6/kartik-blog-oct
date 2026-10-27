import { z } from 'zod';

export const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });
export const postSchema = z.object({
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200),
  excerpt: z.string().max(500).optional().default(''),
  content: z.string().max(900_000).optional().default(''),
  coverImage: z.string().max(2000).optional().default(''),
  coverAlt: z.string().max(250).optional().default(''),
  category: z.string().max(80).optional().default('Field notes'),
  tags: z.array(z.string().max(40)).max(30).optional().default([]),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
  readTime: z.coerce.number().int().min(1).max(120).optional().default(5),
  seo: z.object({ title: z.string().max(180).optional(), description: z.string().max(300).optional(), canonicalUrl: z.string().url().optional(), ogImage: z.string().url().optional() }).optional().default({})
});
export const commentSchema = z.object({ name: z.string().trim().min(1).max(80), email: z.string().email().max(254), body: z.string().trim().min(2).max(3000) });
export const subscribeSchema = z.object({ email: z.string().email().max(254) });
export const contactSchema = z.object({ name: z.string().trim().min(1).max(100), email: z.string().email().max(254), subject: z.string().max(200).optional().default(''), message: z.string().trim().min(5).max(5000) });
export const pageSchema = z.object({ title: z.string().max(180).optional().default(''), content: z.record(z.string(), z.unknown()), seo: z.record(z.string(), z.unknown()).optional().default({}), published: z.boolean().optional().default(true) });
export const settingsSchema = z.record(z.string(), z.unknown());
