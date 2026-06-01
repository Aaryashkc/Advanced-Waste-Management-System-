import nodemailer from 'nodemailer';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function getMailConfig() {
  const hasBrevoConfig = Boolean(process.env.BREVO_API_KEY || process.env.BREVO_SENDER_EMAIL);

  if (hasBrevoConfig) {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || 'GreenShift Nepal';
    const timeoutMs = Number(process.env.BREVO_TIMEOUT_MS || 10000);

    if (!apiKey || !senderEmail) {
      throw new Error('BREVO_API_KEY and BREVO_SENDER_EMAIL are required to send OTP email with Brevo');
    }

    return { provider: 'brevo', apiKey, senderEmail, senderName, timeoutMs };
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const senderEmail = process.env.FROM_EMAIL || user;
  const senderName = process.env.SMTP_SENDER_NAME || 'GreenShift Nepal';
  const timeoutMs = Number(process.env.SMTP_TIMEOUT_MS || 10000);
  const family = Number(process.env.SMTP_FAMILY || 4);

  if (!host || !user || !pass) {
    throw new Error('Configure BREVO_API_KEY and BREVO_SENDER_EMAIL, or SMTP_HOST, SMTP_USER, and SMTP_PASS to send OTP email');
  }

  return { provider: 'smtp', host, port, user, pass, senderEmail, senderName, timeoutMs, family };
}

async function sendWithBrevo(config, email, subject, htmlContent) {
  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': config.apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: {
        name: config.senderName,
        email: config.senderEmail
      },
      to: [{ email }],
      subject,
      htmlContent
    }),
    signal: AbortSignal.timeout(config.timeoutMs)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result.message || `Brevo API responded with status ${response.status}`;
    throw new Error(message);
  }
}

async function sendWithSmtp(config, email, subject, htmlContent) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port === 587,
    family: config.family,
    connectionTimeout: config.timeoutMs,
    greetingTimeout: config.timeoutMs,
    socketTimeout: config.timeoutMs,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  await transporter.sendMail({
    from: `"${config.senderName}" <${config.senderEmail}>`,
    to: email,
    subject,
    html: htmlContent
  });
}

/**
 * Send OTP code to user's email
 * @param {string} email - User's email address
 * @param {string} otpCode - 6-digit OTP code
 * @returns {Promise<boolean>} - Success status
 */
export const sendOTPEmail = async (email, otpCode) => {
  try {
    const config = getMailConfig();
    const subject = 'Your OTP Code - GreenShift Nepal';
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #354f52; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">GreenShift Nepal</h1>
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #354f52; text-align: center;">Your OTP Code</h2>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px solid #354f52;">
              <p style="font-size: 28px; font-weight: bold; color: #354f52; letter-spacing: 5px; margin: 0;">
                ${otpCode}
              </p>
            </div>
            <p style="color: #666; text-align: center;">
              This code will expire in 10 minutes.
            </p>
            <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
          <div style="background-color: #354f52; padding: 15px; text-align: center;">
            <p style="color: #ffffff; margin: 0; font-size: 12px;">&copy; GreenShift Nepal. All rights reserved.</p>
          </div>
        </div>
      `;

    if (config.provider === 'brevo') {
      await sendWithBrevo(config, email, subject, htmlContent);
    } else {
      await sendWithSmtp(config, email, subject, htmlContent);
    }

    console.log(`[EMAIL SERVICE] OTP sent successfully to ${email} via ${config.provider}`);
    return true;
  } catch (error) {
    console.error('[EMAIL SERVICE] Error sending OTP email:', {
      code: error.code,
      message: error.message,
    });
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
};

/**
 * Send OTP code to user's phone (SMS)
 * @param {string} phone - User's phone number
 * @param {string} otpCode - 6-digit OTP code
 * @returns {Promise<boolean>} - Success status
 */
export const sendOTPSMS = async (phone, otpCode) => {
  try {
    // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
    console.log(`[SMS SERVICE] Sending OTP to ${phone}: ${otpCode}`);
    
    // Simulate SMS sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return true;
  } catch (error) {
    console.error('[SMS SERVICE] Error sending OTP SMS:', error);
    throw new Error('Failed to send OTP SMS');
  }
};

