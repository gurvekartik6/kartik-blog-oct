import crypto from 'node:crypto';

export function createOpaqueToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
export function unsubscribeTokenForEmail(email, secret = '') {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || 'local-development-only-secret-change-this')
    .update(String(email).toLowerCase().trim())
    .update('\0')
    .update(String(secret))
    .digest('base64url');
}
export function visitorHash(visitorId) {
  return crypto.createHash('sha256').update(String(visitorId)).digest('hex');
}
