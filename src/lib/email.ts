// Email utility — uses environment variables for SMTP config.
// nodemailer is optional — if not installed, email features report "Not Configured".

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function testSmtpConnection(): Promise<{ connected: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    return { connected: false, error: 'SMTP not configured' };
  }

  try {
    // Dynamic require to avoid build error when nodemailer is not installed
    let nodemailer;
    try { nodemailer = require('nodemailer'); } catch { return { connected: false, error: 'nodemailer package not installed' }; }

    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000,
    });

    await transport.verify();
    return { connected: true };
  } catch (e: any) {
    return { connected: false, error: e.message };
  }
}

export async function sendEmail(options: { to: string; subject: string; html: string; text?: string }): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    return { success: false, error: 'Email not configured' };
  }

  try {
    let nodemailer;
    try { nodemailer = require('nodemailer'); } catch { return { success: false, error: 'nodemailer not installed' }; }

    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000,
    });

    await transport.sendMail({
      from: `${process.env.SMTP_FROM_NAME || 'Alaya Insider'} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: options.to, subject: options.subject, html: options.html, text: options.text,
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
