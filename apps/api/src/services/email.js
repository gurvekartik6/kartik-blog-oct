import { Resend } from 'resend';
import { env } from '../config/env.js';

export async function sendEmail({ to, subject, html, text }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.log(`[email:local] to=${to} subject=${subject}\n${text || '(no text body)'}`);
    return { id: `local-${Date.now()}`, local: true };
  }
  const client = new Resend(env.RESEND_API_KEY);
  const { data, error } = await client.emails.send({ from: env.EMAIL_FROM, to, subject, html, text });
  if (error) throw new Error(error.message || 'Email provider error');
  return data;
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
