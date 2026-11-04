import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export async function sendEmail({ to, subject, html, text }) {
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
    });
    const result = await transporter.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      to,
      subject,
      html,
      text
    });
    return { id: result.messageId };
  }
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.log(`[email:local] to=${to} subject=${subject}\n${text || '(no text body)'}`);
    return { id: `local-${Date.now()}`, local: true };
  }
  const client = new Resend(env.RESEND_API_KEY);
  const { data, error } = await client.emails.send({ from: env.EMAIL_FROM, to, subject, html, text });
  if (error) {
    console.error('Email provider error:', {
      message: error.message || 'Unknown provider error',
      name: error.name || '',
      statusCode: error.statusCode || '',
      from: env.EMAIL_FROM,
      recipientDomain: String(to).split('@').pop() || ''
    });
    const providerError = new Error('Email delivery is temporarily unavailable. Please try again later.');
    providerError.status = 503;
    providerError.code = 'EMAIL_PROVIDER_UNAVAILABLE';
    throw providerError;
  }
  return data;
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
