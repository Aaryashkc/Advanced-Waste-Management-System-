import nodemailer from 'nodemailer';

const SMTP_TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS || 10000);
const SMTP_FAMILY = Number(process.env.SMTP_FAMILY || 4);
const SMTP_HOST = 'send.one.com';
const SMTP_PORT = 587;

function getMailConfig() {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const from = process.env.FROM_EMAIL || user;

  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS are required to send OTP email');
  }

  return { user, pass, from };
}

// Create a transporter object using SMTP transport
const createTransporter = () => {
  const { user, pass } = getMailConfig();

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    requireTLS: true,
    family: SMTP_FAMILY,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
    auth: {
      user,
      pass
    }
  });
};

/**
 * Send OTP code to user's email
 * @param {string} email - User's email address
 * @param {string} otpCode - 6-digit OTP code
 * @returns {Promise<boolean>} - Success status
 */
export const sendOTPEmail = async (email, otpCode) => {
  try {
    const { from } = getMailConfig();
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Safabin Nepal" <${from}>`,
      to: email,
      subject: 'Your OTP Code - Safabin Nepal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #354f52; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Safabin Nepal</h1>
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
            <p style="color: #ffffff; margin: 0; font-size: 12px;">&copy; Safabin Nepal. All rights reserved.</p>
          </div>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE] OTP sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('[EMAIL SERVICE] Error sending OTP email:', {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      response: error.response,
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

