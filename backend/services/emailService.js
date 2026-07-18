import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

/* ------------------------------------------------------------------ */
/*  Nodemailer transport factory                                      */
/*  Lazily creates and caches a reusable transport so that we do not   */
/*  re-connect on every call. Returns null when SMTP is not configured,*/
/*  allowing graceful degradation for local development.              */
/* ------------------------------------------------------------------ */

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST) {
    logger.info('[emailService] SMTP_HOST not set — email sending disabled');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true',
    auth: SMTP_USER && SMTP_PASS
      ? { user: SMTP_USER, pass: SMTP_PASS }
      : undefined,
  });

  logger.info('[emailService] Nodemailer transport initialized');
  return transporter;
}

/* ------------------------------------------------------------------ */
/*  Send verification email                                           */
/*  Returns true on success or when SMTP is disabled (graceful pass).  */
/*  Logs a non-fatal warning if the SMTP send itself fails so that     */
/*  registration is not blocked by mail issues.                       */
/* ------------------------------------------------------------------ */

async function sendVerificationEmail({ to, token }) {
  const transport = getTransporter();
  if (!transport) {
    logger.info('[emailService] Skipping verification email for %s (SMTP not configured)', to);
    return true;
  }

  const origin = process.env.CLIENT_URL?.split(',')[0]?.trim() || 'http://localhost:3000';
  const verifyLink = `${origin}/verify-email?token=${encodeURIComponent(token)}`;

  try {
    await transport.sendMail({
      from: `"Where Is My Model" <${process.env.SMTP_FROM || 'noreply@example.com'}>`,
      to,
      subject: 'Verifica tu cuenta — Where Is My Model',
      text: `Haz clic en el siguiente enlace para verificar tu correo:\n\n${verifyLink}`,
      html: `<p>Haz clic en el siguiente enlace para verificar tu correo:</p>
             <p><a href="${verifyLink}">${verifyLink}</a></p>`,
    });
    logger.info('[emailService] Verification email sent to %s', to);
    return true;
  } catch (err) {
    logger.warn('[emailService] Failed to send verification email to %s: %s', to, err.message);
    return false;
  }
}

export default { getTransporter, sendVerificationEmail };
