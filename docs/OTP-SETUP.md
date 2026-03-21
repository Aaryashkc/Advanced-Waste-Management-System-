# OTP Setup Guide

## How OTP Works

### Current Setup (Development Mode)

**Right now, OTP is generated and logged to console only:**

1. **User requests OTP** → Frontend calls `POST /api/auth/request-otp` with email
2. **Backend generates OTP** → Random 6-digit code (e.g., `123456`)
3. **OTP is hashed** → Stored securely in database (SHA-256 hash)
4. **OTP is logged** → Check your **backend terminal/console** to see the OTP code
5. **User enters OTP** → Frontend calls `POST /api/auth/verify-otp` with email + OTP
6. **Backend verifies** → Compares hashed OTP, returns JWT token if valid

### Where to Find OTP (Development Mode)

**Check your backend terminal/console** where you ran `npm run dev`. You'll see:

```
========================================
📧 [EMAIL SERVICE] OTP Email (Development Mode)
To: user@example.com
Subject: Your OTP Code
OTP Code: 123456
Expires in: 10 minutes
========================================
```

**Copy that OTP code and use it to login!**

---

## Option 1: Keep Using Console Logs (Easiest - For Development)

**No setup needed!** Just check your backend console for the OTP code.

---

## Option 2: Send Real Emails (For Production)

### Step 1: Choose an Email Service

You have several options:

#### A. Gmail (Easiest for Testing)

1. Go to your Google Account → Security
2. Enable "2-Step Verification"
3. Generate an "App Password" for "Mail"
4. Use that app password (not your regular password)

#### B. Other Options:
- **SendGrid** (Free tier: 100 emails/day)
- **Mailgun** (Free tier: 5,000 emails/month)
- **AWS SES** (Very cheap, $0.10 per 1,000 emails)
- **Outlook/Hotmail** (Similar to Gmail setup)

### Step 2: Install Nodemailer (Already Done ✅)

```bash
npm install nodemailer
```

### Step 3: Configure Environment Variables

Create or update `.env` file in the root directory:

```env
# Email Configuration (Gmail Example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password-here
FROM_EMAIL=your-email@gmail.com
```

**For Gmail:**
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587` (or `465` for SSL)
- `SMTP_USER=your-email@gmail.com`
- `SMTP_PASS=your-app-password` (NOT your regular password!)

**For Outlook:**
- `SMTP_HOST=smtp-mail.outlook.com`
- `SMTP_PORT=587`
- `SMTP_USER=your-email@outlook.com`
- `SMTP_PASS=your-password`

**For SendGrid:**
- `SMTP_HOST=smtp.sendgrid.net`
- `SMTP_PORT=587`
- `SMTP_USER=apikey`
- `SMTP_PASS=your-sendgrid-api-key`

### Step 4: Restart Backend Server

```bash
npm run dev
```

Now OTPs will be sent to real email addresses! 🎉

---

## How It Works (Technical)

### OTP Generation
```javascript
// Generates random 6-digit number: 100000-999999
const otp = Math.floor(100000 + Math.random() * 900000).toString();
// Example: "123456"
```

### OTP Storage
```javascript
// OTP is hashed before storing (never store plaintext!)
const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
// Stored in: user.loginOtp.hash
```

### OTP Verification
```javascript
// When user enters OTP, hash it and compare
const inputHash = hashOTP(userInput);
const isValid = inputHash === storedHash;
```

### Security Features
- ✅ OTP expires in 10 minutes
- ✅ Maximum 5 verification attempts
- ✅ 60-second cooldown between requests
- ✅ OTP is hashed (never stored in plaintext)
- ✅ OTP cleared after successful verification

---

## Testing

### Test Console Logging (Current Setup)
1. Start backend: `npm run dev`
2. Try to login with any email
3. Check backend console for OTP code
4. Use that code to verify

### Test Real Email
1. Configure `.env` with email credentials
2. Restart backend
3. Try to login with your real email
4. Check your email inbox for OTP code

---

## Troubleshooting

### "OTP not received"
- **Development mode**: Check backend console
- **Production mode**: 
  - Check spam folder
  - Verify SMTP credentials in `.env`
  - Check backend console for errors

### "Failed to send OTP email"
- Verify SMTP credentials are correct
- For Gmail: Make sure you're using App Password, not regular password
- Check firewall/antivirus isn't blocking SMTP
- Try different SMTP port (587 or 465)

### "OTP expired"
- OTPs expire after 10 minutes
- Request a new OTP

### "Too many attempts"
- Maximum 5 wrong attempts per OTP
- Request a new OTP

---

## Quick Start (Development)

**Just use console logs!** No setup needed:

1. Start backend: `npm run dev`
2. Login with any email
3. **Check backend terminal** for OTP code
4. Use that code to login

That's it! 🚀

