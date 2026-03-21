import nodemailer from 'nodemailer';

// Create a transporter object using SMTP transport
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports like 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
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
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: email,
      subject: 'Your OTP Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Your OTP Code</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="font-size: 24px; font-weight: bold; color: #007bff; letter-spacing: 3px; margin: 0;">
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
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE] OTP sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('[EMAIL SERVICE] Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
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

