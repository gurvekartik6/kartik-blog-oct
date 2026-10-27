import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;
const options = { timestamps: true, strict: true };

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin'], default: 'admin' },
  active: { type: Boolean, default: true },
  lastLoginAt: Date
}, options);

const postSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  excerpt: { type: String, default: '', maxlength: 500 },
  content: { type: Schema.Types.Mixed, default: '' },
  coverImage: { type: String, default: '' },
  coverAlt: { type: String, default: '', maxlength: 250 },
  category: { type: String, default: 'Field notes' },
  tags: [{ type: String, trim: true, lowercase: true }],
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  publishedAt: Date,
  scheduledAt: Date,
  readTime: { type: Number, default: 5 },
  seo: { title: String, description: String, canonicalUrl: String, ogImage: String },
  likeCount: { type: Number, default: 0, min: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, options);
postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ title: 'text', excerpt: 'text', content: 'text' });

const commentSchema = new Schema({
  post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, select: false },
  body: { type: String, required: true, trim: true, maxlength: 3000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'spam'], default: 'pending', index: true },
  parent: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
  approvedAt: Date
}, options);

const likeSchema = new Schema({
  post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  visitorHash: { type: String, required: true }
}, options);
likeSchema.index({ post: 1, visitorHash: 1 }, { unique: true });

const subscriberSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  status: { type: String, enum: ['pending', 'confirmed', 'unsubscribed', 'suppressed'], default: 'pending', index: true },
  confirmTokenHash: { type: String, select: false },
  unsubscribeTokenHash: { type: String, select: false },
  unsubscribeSecret: { type: String, select: false },
  consentAt: Date,
  confirmedAt: Date,
  unsubscribedAt: Date,
  source: { type: String, default: 'website' }
}, options);

const pageSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  title: { type: String, default: '' },
  content: { type: Schema.Types.Mixed, default: {} },
  seo: { title: String, description: String, canonicalUrl: String, ogImage: String },
  published: { type: Boolean, default: true }
}, options);

const settingsSchema = new Schema({
  key: { type: String, unique: true, default: 'global' },
  settings: { type: Schema.Types.Mixed, default: {} }
}, options);

const campaignSchema = new Schema({
  post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  idempotencyKey: { type: String, required: true, unique: true },
  status: { type: String, enum: ['queued', 'processing', 'completed', 'failed'], default: 'queued', index: true },
  recipientCount: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  startedAt: Date,
  completedAt: Date
}, options);

const contactSchema = new Schema({
  name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, maxlength: 254 },
  subject: { type: String, default: '', maxlength: 200 },
  message: { type: String, required: true, maxlength: 5000 },
  status: { type: String, enum: ['new', 'read', 'archived'], default: 'new' }
}, options);

const auditSchema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  resourceType: String,
  resourceId: String,
  metadata: Schema.Types.Mixed,
  ip: String
}, { timestamps: true });

export const User = models.User || model('User', userSchema);
export const Post = models.Post || model('Post', postSchema);
export const Comment = models.Comment || model('Comment', commentSchema);
export const Like = models.Like || model('Like', likeSchema);
export const Subscriber = models.Subscriber || model('Subscriber', subscriberSchema);
export const Page = models.Page || model('Page', pageSchema);
export const SiteSettings = models.SiteSettings || model('SiteSettings', settingsSchema);
export const NewsletterCampaign = models.NewsletterCampaign || model('NewsletterCampaign', campaignSchema);
export const ContactMessage = models.ContactMessage || model('ContactMessage', contactSchema);
export const AuditLog = models.AuditLog || model('AuditLog', auditSchema);


const mediaSchema = new Schema({
  originalName: { type: String, required: true, maxlength: 255 },
  filename: { type: String, required: true, unique: true },
  url: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 0 },
  alt: { type: String, default: '', maxlength: 250 },
  storage: { type: String, enum: ['local'], default: 'local' }
}, options);
export const Media = models.Media || model('Media', mediaSchema);


const newsletterDeliverySchema = new Schema({
  campaign: { type: Schema.Types.ObjectId, ref: 'NewsletterCampaign', required: true, index: true },
  subscriber: { type: Schema.Types.ObjectId, ref: 'Subscriber', required: true, index: true },
  email: { type: String, required: true, lowercase: true },
  status: { type: String, enum: ['queued', 'sent', 'failed', 'suppressed'], default: 'queued', index: true },
  providerMessageId: String,
  attempts: { type: Number, default: 0 },
  lastError: { type: String, default: '' },
  sentAt: Date
}, options);
newsletterDeliverySchema.index({ campaign: 1, subscriber: 1 }, { unique: true });
export const NewsletterDelivery = models.NewsletterDelivery || model('NewsletterDelivery', newsletterDeliverySchema);
