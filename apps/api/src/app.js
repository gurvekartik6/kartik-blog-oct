import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import sanitizeHtml from 'sanitize-html';
import { env, isProduction } from './config/env.js';
import { User, Post, Comment, Like, Subscriber, Page, SiteSettings, NewsletterCampaign, NewsletterDelivery, ContactMessage, AuditLog, Media } from './models/index.js';
import { requireAdmin } from './middleware/auth.js';
import { validate } from './middleware/validate.js';
import { loginSchema, postSchema, commentSchema, subscribeSchema, contactSchema, pageSchema, settingsSchema } from './schemas.js';
import { createOpaqueToken, hashToken, visitorHash, unsubscribeTokenForEmail } from './services/tokens.js';
import { sendEmail, escapeHtml } from './services/email.js';
import { newsletterQueue } from './services/queue.js';

export const app = express();
app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = new Set(env.CORS_ORIGINS.split(',').map(x => x.trim()).filter(Boolean));
allowedOrigins.add(new URL(env.CLIENT_URL).origin);
allowedOrigins.add(new URL(env.API_URL).origin);
app.use(cors({ origin: [...allowedOrigins], credentials: true }));
// SameSite cookies are a useful baseline; reject cross-origin browser mutations as an additional CSRF defense.
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.headers.origin && !allowedOrigins.has(req.headers.origin)) {
    return res.status(403).json({ error: 'Cross-origin request blocked.' });
  }
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());
app.use(session({
  name: 'blog.sid',
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: env.MONGODB_URI, collectionName: 'sessions', ttl: 60 * 60 * 12 }),
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 1000 * 60 * 60 * 12 }
}));

const uploadDir = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir, { maxAge: isProduction ? '7d' : 0, immutable: isProduction }));
const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => { const extension = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' })[file.mimetype] || ''; cb(null, `${crypto.randomUUID()}${extension}`); }
});
const upload = multer({
  storage: mediaStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['image/jpeg','image/png','image/webp','image/gif']);
    if (!allowed.has(file.mimetype)) return cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed.'));
    cb(null, true);
  }
});
const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
app.use('/api', publicLimiter);

async function audit(req, action, resourceType, resourceId, metadata = {}) {
  try { await AuditLog.create({ actor: req.session?.user?.id, action, resourceType, resourceId: String(resourceId || ''), metadata, ip: req.ip }); } catch (error) { console.error('Audit log error:', error.message); }
}
function sanitizeContent(content) {
  if (typeof content !== 'string') return content;
  return sanitizeHtml(content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','h1','h2','h3','figure','figcaption','u','s']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href','name','target','rel'],
      img: ['src','alt','title','width','height','loading'],
      '*': ['class']
    },
    allowedSchemes: ['http','https','mailto'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }) }
  });
}
async function queuePublication(post) {
  const key = `post:${post._id}:publication:${post.publishedAt?.toISOString() || post.updatedAt.toISOString()}`;
  let campaign;
  try {
    campaign = await NewsletterCampaign.create({ post: post._id, idempotencyKey: key, status: 'queued' });
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
  try {
    // BullMQ reserves ':' in custom job IDs; keep it only in the database idempotency key.
    await newsletterQueue.add('announce-post', { campaignId: String(campaign._id), postId: String(post._id) }, { jobId: key.replace(/:/g, '-') });
    return campaign;
  } catch (error) {
    campaign.status = 'failed';
    await campaign.save().catch(() => {});
    throw error;
  }
}
function publicPost(post) {
  const obj = post.toObject ? post.toObject() : post;
  return { ...obj, content: obj.content ?? '' };
}
async function seedDefaults() {
  if (!(await SiteSettings.exists({ key: 'global' }))) {
    await SiteSettings.create({ key: 'global', settings: {
      siteName: 'Field Notes', tagline: 'Notes from the learning curve.',
      homeTitle: 'A work in progress,\\nand proud of it.',
      homeSubtitle: 'Thoughts on engineering, technology, work, setbacks, and the lessons that never fit neatly into a syllabus.',
      navigation: [{ label: 'Home', href: '/' }, { label: 'About', href: '/about' }, { label: 'Writing', href: '/blog' }, { label: 'Journey', href: '/journey' }, { label: 'Contact', href: '/contact' }],
      footerText: 'Made slowly, learned along the way.', heroImage: '', heroImageAlt: '', socialLinks: [], theme: { accent: '#b6c8a8' }
    } });
  }
  for (const [key, title, content] of [
    ['about', 'About me', { eyebrow: 'A LITTLE CONTEXT', intro: 'Still becoming. That is the point.', description: 'I’m an engineering student interested in the space where technology, practical problem-solving, and human experience meet.', heading: 'More than a résumé', body: 'A personal account of learning, engineering, and the work in between.', image: '', imageAlt: '' }],
    ['blog', 'Writing', { eyebrow: 'THE NOTEBOOK', headline: 'Ideas, experiences, and everything between.', intro: 'A growing collection of things learned the hard way, things still being figured out, and thoughts worth writing down.', searchPlaceholder: 'Search stories, topics, lessons…', emptyText: 'No stories match that search yet.', image: '', imageAlt: '' }],
    ['journey', 'My journey', { eyebrow: 'CHAPTERS SO FAR', headline: 'A path, not a straight line.', intro: 'Every experience leaves behind a different tool, question, or way of seeing things.', entries: [], image: '', imageAlt: '' }],
    ['contact', 'Contact', { eyebrow: 'OPEN INBOX', intro: 'Have a thought? Let’s talk.', description: 'Questions, shared experiences, thoughtful feedback, or just a hello — the form is open.', image: '', imageAlt: '' }]
  ]) {
    const existing = await Page.findOne({ key });
    if (!existing) {
      await Page.create({ key, title, content, published: true });
    } else {
      const currentContent = existing.content && typeof existing.content === 'object' ? existing.content : {};
      const mergedContent = { ...content, ...currentContent };
      const missingDefaults = Object.keys(content).some(field => currentContent[field] === undefined);
      if (missingDefaults) {
        existing.content = mergedContent;
        await existing.save();
      }
    }
  }
}
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${env.API_URL.replace(/\/+$/, '')}/sitemap.xml\n`);
});
app.get('/sitemap.xml', async (req, res, next) => {
  try {
    const posts = await Post.find({ status: 'published', publishedAt: { $lte: new Date() } }).select('slug updatedAt publishedAt').lean();
    const urls = [
      '', '/about', '/blog', '/journey', '/contact',
      ...posts.map(post => `/blog/${encodeURIComponent(post.slug)}`)
    ].map(route => `<url><loc>${env.CLIENT_URL.replace(/\/+$/, '').replace(/&/g, '&amp;')}${route}</loc></url>`).join('');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  } catch (e) { next(e); }
});

app.get('/api/site', async (req, res, next) => {
  try { const doc = await SiteSettings.findOne({ key: 'global' }).lean(); res.json({ settings: doc?.settings || {} }); } catch (e) { next(e); }
});
app.get('/api/pages/:key', async (req, res, next) => {
  try {
    const page = await Page.findOne({ key: req.params.key, published: true }).lean();
    if (!page) return res.status(404).json({ error: 'Page not found.' });
    res.json({ page });
  } catch (e) { next(e); }
});
app.get('/api/posts', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
    const filter = { status: 'published', publishedAt: { $lte: new Date() } };
    if (req.query.category) filter.category = String(req.query.category).slice(0, 80);
    if (req.query.q) filter.$text = { $search: String(req.query.q).slice(0, 100) };
    const [items, total] = await Promise.all([
      Post.find(filter).sort({ publishedAt: -1 }).limit(limit).select('-content').lean(),
      Post.countDocuments(filter)
    ]);
    res.json({ items, total });
  } catch (e) { next(e); }
});
app.get('/api/posts/:slug', async (req, res, next) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug, status: 'published', publishedAt: { $lte: new Date() } }).lean();
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    const comments = await Comment.find({ post: post._id, status: 'approved' }).select('name body createdAt').sort({ createdAt: 1 }).limit(100).lean();
    const liked = req.cookies?.blog_visitor
      ? Boolean(await Like.exists({ post: post._id, visitorHash: visitorHash(req.cookies.blog_visitor) }))
      : false;
    res.json({ post, comments, liked });
  } catch (e) { next(e); }
});
app.post('/api/posts/:slug/like', writeLimiter, async (req, res, next) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug, status: 'published', publishedAt: { $lte: new Date() } });
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    const visitorId = req.cookies?.blog_visitor || crypto.randomUUID();
    const id = visitorHash(visitorId);
    const existing = await Like.findOne({ post: post._id, visitorHash: id });
    if (existing) {
      await Like.deleteOne({ _id: existing._id });
      post.likeCount = Math.max(0, post.likeCount - 1);
      await post.save();
      return res.json({ liked: false, likeCount: post.likeCount });
    }
    try { await Like.create({ post: post._id, visitorHash: id }); }
    catch (error) { if (error.code !== 11000) throw error; }
    post.likeCount = await Like.countDocuments({ post: post._id });
    await post.save();
    res.cookie('blog_visitor', visitorId, { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 1000 * 60 * 60 * 24 * 365 });
    res.json({ liked: true, likeCount: post.likeCount });
  } catch (e) { next(e); }
});
app.post('/api/posts/:slug/comments', writeLimiter, validate(commentSchema), async (req, res, next) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug, status: 'published', publishedAt: { $lte: new Date() } });
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    await Comment.create({ post: post._id, ...req.body, status: 'pending' });
    res.status(201).json({ message: 'Thanks. Your comment is awaiting moderation.' });
  } catch (e) { next(e); }
});
app.post('/api/newsletter/subscribe', writeLimiter, validate(subscribeSchema), async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const existing = await Subscriber.findOne({ email }).select('+confirmTokenHash +unsubscribeTokenHash');
    if (existing?.status === 'confirmed') return res.json({ message: 'You are already subscribed.' });
    const confirm = createOpaqueToken();
    const subscriber = existing || new Subscriber({ email });
    const unsubscribeSecret = createOpaqueToken().token;
    const unsubscribeToken = unsubscribeTokenForEmail(email, unsubscribeSecret);
    subscriber.status = 'pending';
    subscriber.confirmTokenHash = confirm.hash;
    subscriber.unsubscribeTokenHash = hashToken(unsubscribeToken);
    subscriber.unsubscribeSecret = unsubscribeSecret;
    subscriber.consentAt = new Date();
    await subscriber.save();
    const url = `${env.API_URL.replace(/\/+$/, '')}/api/newsletter/confirm?token=${encodeURIComponent(confirm.token)}`;
    const unsubscribeUrl = `${env.API_URL.replace(/\/+$/, '')}/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
    await sendEmail({
      to: email, subject: 'Confirm your Field Notes subscription',
      html: `<p>Please confirm that you want to receive new writing from Field Notes.</p><p><a href="${url}">Confirm subscription</a></p><p>If you did not request this, you can ignore this email.</p><p><a href="${unsubscribeUrl}">Unsubscribe</a></p>`,
      text: `Confirm your subscription: ${url}\nUnsubscribe: ${unsubscribeUrl}`
    });
    res.status(202).json({ message: 'Check your inbox to confirm your subscription.' });
  } catch (e) { next(e); }
});
app.get('/api/newsletter/confirm', async (req, res, next) => {
  try {
    if (typeof req.query.token !== 'string') return res.status(400).send('Invalid confirmation link.');
    const subscriber = await Subscriber.findOne({ confirmTokenHash: hashToken(req.query.token), status: 'pending' });
    if (!subscriber) return res.status(400).send('This confirmation link is invalid, expired, or already used.');
    res.type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Confirm subscription</title><body><main><h1>Confirm your subscription</h1><p>Confirm that you want to receive new writing from Field Notes.</p><form method="post" action="/api/newsletter/confirm"><input type="hidden" name="token" value="${escapeHtml(req.query.token)}"><button type="submit">Confirm subscription</button></form></main></body></html>`);
  } catch (e) { next(e); }
});
app.post('/api/newsletter/confirm', async (req, res, next) => {
  try {
    if (typeof req.body.token !== 'string') return res.status(400).send('Invalid confirmation link.');
    const subscriber = await Subscriber.findOne({ confirmTokenHash: hashToken(req.body.token), status: 'pending' }).select('+confirmTokenHash');
    if (!subscriber) return res.status(400).send('This confirmation link is invalid, expired, or already used.');
    subscriber.status = 'confirmed';
    subscriber.confirmedAt = new Date();
    subscriber.confirmTokenHash = undefined;
    await subscriber.save();
    res.type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><title>Subscription confirmed</title><body><main><h1>Subscription confirmed</h1><p>Thanks for joining. You can close this page and return to the blog.</p></main></body></html>');
  } catch (e) { next(e); }
});
app.get('/api/newsletter/unsubscribe', async (req, res, next) => {
  try {
    if (typeof req.query.token !== 'string') return res.status(400).send('Invalid unsubscribe link.');
    const subscriber = await Subscriber.findOne({ unsubscribeTokenHash: hashToken(req.query.token), status: { $in: ['confirmed','pending'] } });
    if (!subscriber) return res.status(400).send('This unsubscribe link is invalid.');
    res.type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Unsubscribe</title><body><main><h1>Unsubscribe from Field Notes</h1><p>Confirm that you no longer want to receive newsletter emails.</p><form method="post" action="/api/newsletter/unsubscribe"><input type="hidden" name="token" value="${escapeHtml(req.query.token)}"><button type="submit">Unsubscribe</button></form></main></body></html>`);
  } catch (e) { next(e); }
});
app.post('/api/newsletter/unsubscribe', async (req, res, next) => {
  try {
    if (typeof req.body.token !== 'string') return res.status(400).send('Invalid unsubscribe link.');
    const subscriber = await Subscriber.findOne({ unsubscribeTokenHash: hashToken(req.body.token), status: { $in: ['confirmed','pending'] } }).select('+unsubscribeTokenHash +confirmTokenHash');
    if (!subscriber) return res.status(400).send('This unsubscribe link is invalid.');
    subscriber.status = 'unsubscribed';
    subscriber.unsubscribedAt = new Date();
    subscriber.confirmTokenHash = undefined;
    await subscriber.save();
    res.type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><title>Unsubscribed</title><body><main><h1>You are unsubscribed</h1><p>You will not receive further newsletter emails.</p></main></body></html>');
  } catch (e) { next(e); }
});
app.post('/api/contact', writeLimiter, validate(contactSchema), async (req, res, next) => {
  try { await ContactMessage.create(req.body); res.status(201).json({ message: 'Message received. Thank you for writing.' }); }
  catch (e) { next(e); }
});

app.post('/api/admin/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
    const bcrypt = await import('bcryptjs');
    const valid = user && user.active && await bcrypt.default.compare(req.body.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });
    req.session.regenerate(error => {
      if (error) return next(error);
      req.session.user = { id: String(user._id), email: user.email, role: user.role };
      user.lastLoginAt = new Date();
      user.save().catch(console.error);
      res.json({ user: { id: String(user._id), email: user.email, role: user.role } });
    });
  } catch (e) { next(e); }
});
app.get('/api/admin/session', requireAdmin, (req, res) => res.json({ user: req.session.user }));
app.post('/api/admin/logout', requireAdmin, (req, res, next) => req.session.destroy(error => {
  if (error) return next(error);
  res.clearCookie('blog.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction });
  res.status(204).end();
}));
app.get('/api/admin/dashboard', requireAdmin, async (req, res, next) => {
  try {
    const [posts, drafts, comments, pendingComments, subscribers, likes, messages, campaigns] = await Promise.all([
      Post.countDocuments({ status: 'published' }), Post.countDocuments({ status: 'draft' }),
      Comment.countDocuments(), Comment.countDocuments({ status: 'pending' }),
      Subscriber.countDocuments({ status: 'confirmed' }), Like.countDocuments(),
      ContactMessage.countDocuments({ status: 'new' }), NewsletterCampaign.countDocuments()
    ]);
    res.json({ stats: { posts, drafts, comments, pendingComments, subscribers, likes, messages, campaigns } });
  } catch (e) { next(e); }
});
app.get('/api/admin/posts', requireAdmin, async (req, res, next) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const items = await Post.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
    res.json({ items });
  } catch (e) { next(e); }
});
app.post('/api/admin/posts', requireAdmin, writeLimiter, validate(postSchema), async (req, res, next) => {
  try {
    const data = { ...req.body, content: sanitizeContent(req.body.content), createdBy: req.session.user.id };
    if (data.status === 'published') data.publishedAt = new Date();
    const post = await Post.create(data);
    await audit(req, 'post.create', 'Post', post._id);
    let newsletterQueued = null;
    if (post.status === 'published') {
      try { await queuePublication(post); }
      catch (queueError) { newsletterQueued = false; console.error('Post published but newsletter queueing failed:', queueError.message); }
    }
    res.status(201).json({ post, newsletterQueued });
  } catch (e) { if (e.code === 11000) return res.status(409).json({ error: 'That slug is already in use.' }); next(e); }
});
app.put('/api/admin/posts/:id', requireAdmin, writeLimiter, validate(postSchema), async (req, res, next) => {
  try {
    const existing = await Post.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Post not found.' });
    const wasPublished = existing.status === 'published';
    Object.assign(existing, { ...req.body, content: sanitizeContent(req.body.content) });
    const newlyPublished = !wasPublished && existing.status === 'published';
    if (newlyPublished || (existing.status === 'published' && !existing.publishedAt)) existing.publishedAt = new Date();
    await existing.save();
    await audit(req, 'post.update', 'Post', existing._id);
    let newsletterQueued = null;
    if (newlyPublished) {
      try { await queuePublication(existing); }
      catch (queueError) { newsletterQueued = false; console.error('Post published but newsletter queueing failed:', queueError.message); }
    }
    res.json({ post: existing, newlyPublished, newsletterQueued });
  } catch (e) { if (e.code === 11000) return res.status(409).json({ error: 'That slug is already in use.' }); next(e); }
});
app.delete('/api/admin/posts/:id', requireAdmin, async (req, res, next) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    await Promise.all([Comment.deleteMany({ post: post._id }), Like.deleteMany({ post: post._id })]);
    await audit(req, 'post.delete', 'Post', post._id);
    res.status(204).end();
  } catch (e) { next(e); }
});
app.get('/api/admin/comments', requireAdmin, async (req, res, next) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const items = await Comment.find(filter).select('-email').populate('post', 'title slug').sort({ createdAt: -1 }).limit(300).lean();
    res.json({ items });
  } catch (e) { next(e); }
});
app.patch('/api/admin/comments/:id', requireAdmin, async (req, res, next) => {
  try {
    const status = ['pending', 'approved', 'rejected', 'spam'].includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ error: 'Invalid moderation status.' });
    const comment = await Comment.findByIdAndUpdate(req.params.id, { status, ...(status === 'approved' ? { approvedAt: new Date() } : {}) }, { new: true }).select('-email');
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });
    await audit(req, 'comment.moderate', 'Comment', comment._id, { status });
    res.json({ comment });
  } catch (e) { next(e); }
});
app.get('/api/admin/subscribers', requireAdmin, async (req, res, next) => {
  try {
    const items = await Subscriber.find().select('email status consentAt confirmedAt unsubscribedAt createdAt').sort({ createdAt: -1 }).limit(5000).lean();
    res.json({ items });
  } catch (e) { next(e); }
});
app.get('/api/admin/pages', requireAdmin, async (req, res, next) => {
  try { res.json({ items: await Page.find().sort({ key: 1 }).lean() }); } catch (e) { next(e); }
});
app.put('/api/admin/pages/:key', requireAdmin, validate(pageSchema), async (req, res, next) => {
  try {
    const page = await Page.findOneAndUpdate({ key: req.params.key }, { ...req.body, key: req.params.key }, { upsert: true, new: true, runValidators: true });
    await audit(req, 'page.update', 'Page', page._id);
    res.json({ page });
  } catch (e) { next(e); }
});
app.put('/api/admin/settings', requireAdmin, validate(settingsSchema), async (req, res, next) => {
  try {
    const doc = await SiteSettings.findOneAndUpdate({ key: 'global' }, { settings: req.body }, { upsert: true, new: true });
    await audit(req, 'settings.update', 'SiteSettings', doc._id);
    res.json({ settings: doc.settings });
  } catch (e) { next(e); }
});

app.get('/api/admin/media', requireAdmin, async (req, res, next) => {
  try { res.json({ items: await Media.find().sort({ createdAt: -1 }).limit(500).lean() }); } catch (e) { next(e); }
});
app.post('/api/admin/media', requireAdmin, writeLimiter, (req, res, next) => {
  upload.single('file')(req, res, async error => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.message });
    if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
    try {
      const header = Buffer.alloc(12);
      const fileHandle = await fs.promises.open(req.file.path, 'r');
      try { await fileHandle.read(header, 0, header.length, 0); } finally { await fileHandle.close(); }
      const mime = req.file.mimetype;
      const validImage = (mime === 'image/jpeg' && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff)
        || (mime === 'image/png' && header.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))
        || (mime === 'image/gif' && ['GIF87a','GIF89a'].includes(header.toString('ascii', 0, 6)))
        || (mime === 'image/webp' && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP');
      if (!validImage) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: 'The uploaded file contents do not match a supported image format.' });
      }
      const url = `${env.API_URL.replace(/\/+$/, '')}/uploads/${encodeURIComponent(req.file.filename)}`;
      const media = await Media.create({
        originalName: req.file.originalname.slice(0,255), filename: req.file.filename, url,
        mimeType: req.file.mimetype, size: req.file.size, storage: 'local'
      });
      await audit(req, 'media.upload', 'Media', media._id);
      res.status(201).json({ media });
    } catch (e) {
      fs.unlink(req.file.path, () => {});
      next(e);
    }
  });
});
app.delete('/api/admin/media/:id', requireAdmin, async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ error: 'Media item not found.' });
    if (media.storage === 'local') {
      const filePath = path.join(uploadDir, path.basename(media.filename));
      fs.unlink(filePath, error => { if (error && error.code !== 'ENOENT') console.error('Media delete error:', error.message); });
    }
    await media.deleteOne();
    await audit(req, 'media.delete', 'Media', media._id);
    res.status(204).end();
  } catch (e) { next(e); }
});
app.get('/api/admin/contact-messages', requireAdmin, async (req, res, next) => {
  try { res.json({ items: await ContactMessage.find().sort({ createdAt: -1 }).limit(500).lean() }); } catch (e) { next(e); }
});
app.get('/api/admin/campaigns', requireAdmin, async (req, res, next) => {
  try { res.json({ items: await NewsletterCampaign.find().populate('post', 'title slug').sort({ createdAt: -1 }).limit(200).lean() }); } catch (e) { next(e); }
});

app.post('/api/admin/campaigns/:id/retry', requireAdmin, writeLimiter, async (req, res, next) => {
  try {
    const campaign = await NewsletterCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    if (campaign.status !== 'failed') return res.status(409).json({ error: 'Only failed campaigns can be retried.' });
    const post = await Post.findById(campaign.post);
    if (!post || post.status !== 'published' || !post.publishedAt || post.publishedAt > new Date()) {
      return res.status(409).json({ error: 'The associated post is not currently published.' });
    }
    campaign.status = 'queued';
    campaign.completedAt = undefined;
    await campaign.save();
    try {
      await newsletterQueue.add('announce-post', { campaignId: String(campaign._id), postId: String(post._id) }, { jobId: `retry-${campaign._id}-${Date.now()}` });
    } catch (queueError) {
      campaign.status = 'failed';
      await campaign.save().catch(() => {});
      throw queueError;
    }
    await audit(req, 'newsletter.retry', 'NewsletterCampaign', campaign._id);
    res.status(202).json({ campaign });
  } catch (e) { next(e); }
});

app.get('/api/admin/campaigns/:id/deliveries', requireAdmin, async (req, res, next) => {
  try {
    const [sent, failed, queued] = await Promise.all([
      NewsletterDelivery.countDocuments({ campaign: req.params.id, status: 'sent' }),
      NewsletterDelivery.countDocuments({ campaign: req.params.id, status: 'failed' }),
      NewsletterDelivery.countDocuments({ campaign: req.params.id, status: 'queued' })
    ]);
    res.json({ sent, failed, queued });
  } catch (e) { next(e); }
});

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : error.name === 'ValidationError' || error.name === 'MulterError' || error.name === 'CastError' || error.name === 'BSONError' ? 400 : 500;
  res.status(status).json({ error: status === 500 ? 'An unexpected server error occurred.' : error.message });
});

export async function initializeApp() {
  await seedDefaults();
}
