# OTP Authentication Flow Documentation

## Overview

The application uses a secure OTP (One-Time Password) authentication system for user login. This document explains the complete flow, security measures, and token structure.

## Authentication Flow Diagram

```
User → Frontend → Backend → Database
  ↓       ↓         ↓          ↓
Email  Request   Generate   Store Hash
Input   OTP      OTP        + Metadata
  ↓       ↓         ↓          ↓
OTP    Verify    Verify    Check Hash
Input   OTP      Hash      + Expiry
  ↓       ↓         ↓          ↓
Token  Store    Return    Clear OTP
Saved   Token   JWT       from DB
```

## Step-by-Step Flow

### 1. Request OTP

**Frontend (`CustomerLogin.jsx`):**
```javascript
// User enters email and clicks "Log In"
await authAPI.requestOTP(email);
sessionStorage.setItem('otpEmail', email);
navigate('/otp-verification');
```

**Backend (`POST /api/auth/request-otp`):**
1. Validates email format
2. Finds or creates user
3. Checks resend cooldown (60 seconds)
4. Generates 6-digit OTP (100000-999999)
5. Hashes OTP using SHA-256
6. Stores in `user.loginOtp`:
   - `hash`: Hashed OTP
   - `expiresAt`: Current time + 10 minutes
   - `attempts`: 0
   - `lastSentAt`: Current timestamp
7. Sends OTP via email (console log in dev)
8. Returns success response

**Security Measures:**
- OTP is never stored in plaintext
- Cooldown prevents spam/abuse
- Expiration limits window of attack

### 2. Verify OTP

**Frontend (`OTPVerificationPage.jsx`):**
```javascript
// User enters 6-digit OTP
const email = sessionStorage.getItem('otpEmail');
const response = await authAPI.verifyOTP(otpCode, email);

// Store token and user data
localStorage.setItem('accessToken', response.accessToken);
localStorage.setItem('user', JSON.stringify(response.user));
navigate('/customer-landing');
```

**Backend (`POST /api/auth/verify-otp`):**
1. Validates OTP format (6 digits)
2. Finds user by email/phone
3. Checks if OTP exists
4. Validates expiration (`expiresAt > now`)
5. Checks attempt limit (`attempts < 5`)
6. Hashes input OTP and compares with stored hash
7. On success:
   - Clears `loginOtp` from user document
   - Updates `lastLoginAt`
   - Sets `emailVerified` or `phoneVerified`
   - Generates JWT token
   - Returns token and user data
8. On failure:
   - Increments `attempts` counter
   - Returns error with remaining attempts

**Security Measures:**
- Hash comparison prevents timing attacks
- Attempt limiting prevents brute force
- OTP cleared after use (one-time use)
- Expiration enforced

### 3. Authenticated Requests

**Frontend (`api.js`):**
```javascript
// Automatic token injection
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Backend (`auth.middleware.js`):**
1. Extracts token from `Authorization: Bearer <token>` header
2. Verifies JWT signature
3. Finds user by ID from token
4. Attaches user to `req.user`
5. Continues to route handler

## Token Structure

### JWT Payload
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "iat": 1234567890,
  "exp": 1235173890
}
```

### Token Storage
- **Frontend**: Stored in `localStorage` as `accessToken`
- **Backend**: Verified on each request via middleware
- **Expiration**: 7 days (configurable via `JWT_EXPIRES_IN`)

### Token Usage
```http
GET /api/schedule
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Security Measures

### 1. OTP Security

**Hashing:**
- Algorithm: SHA-256
- Implementation: `crypto.createHash('sha256').update(otp).digest('hex')`
- Storage: Only hash is stored, never plaintext

**Expiration:**
- Duration: 10 minutes
- Validation: `new Date() > expiresAt`
- Action: OTP cleared if expired

**Attempt Limiting:**
- Maximum attempts: 5
- Counter: Incremented on each failed verification
- Action: OTP cleared after max attempts

**Rate Limiting:**
- Cooldown: 60 seconds between requests
- Validation: `(now - lastSentAt) >= 60 seconds`
- Action: Returns 429 status with retry time

### 2. Token Security

**JWT Configuration:**
- Algorithm: HS256 (HMAC SHA-256)
- Secret: Stored in `JWT_SECRET` environment variable
- Expiration: 7 days (configurable)

**Storage:**
- Frontend: `localStorage` (consider httpOnly cookies for production)
- Automatic cleanup on 401 responses

**Validation:**
- Signature verification on every request
- User existence check
- Token expiration check

### 3. CORS Configuration

```javascript
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

## Error Handling

### Request OTP Errors

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | Invalid email format | Malformed email | Validate email client-side |
| 429 | Rate limited | Requested too soon | Wait for cooldown period |
| 500 | Email send failed | SMTP error | Check email service config |

### Verify OTP Errors

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | OTP must be 6 digits | Invalid format | Validate input |
| 400 | No OTP found | OTP expired/cleared | Request new OTP |
| 400 | OTP expired | >10 minutes old | Request new OTP |
| 401 | Invalid OTP | Wrong code | Re-enter OTP |
| 429 | Too many attempts | 5 failed attempts | Request new OTP |
| 404 | User not found | Email not registered | Register first |

## Development vs Production

### Development Mode
- OTP codes logged to console
- Email service logs to console
- No actual email/SMS sent
- `NODE_ENV=development`

### Production Mode
- OTP codes NOT logged
- Real email/SMS service required
- Configure SMTP/SMS credentials
- `NODE_ENV=production`

## Email Service Integration

Current implementation logs to console. To integrate real email:

1. Install nodemailer: `npm install nodemailer`
2. Configure SMTP in `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   FROM_EMAIL=noreply@yourapp.com
   ```
3. Uncomment email code in `backend/services/emailService.js`

## SMS Service Integration

For SMS OTP support:

1. Choose provider (Twilio, AWS SNS, etc.)
2. Install SDK
3. Configure credentials in `.env`
4. Update `sendOTPSMS()` in `emailService.js`

## Testing the Flow

### Manual Testing

1. **Request OTP:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/request-otp \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```
   Check console for OTP code.

2. **Verify OTP:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","otp":"123456"}'
   ```

3. **Use Token:**
   ```bash
   curl -X GET http://localhost:5000/api/schedule \
     -H "Authorization: Bearer <token>"
   ```

### Test Scenarios

- ✅ Valid OTP verification
- ✅ Expired OTP (wait 10+ minutes)
- ✅ Invalid OTP (wrong code)
- ✅ Attempt limit (5 wrong attempts)
- ✅ Rate limiting (request OTP twice within 60s)
- ✅ Token expiration (wait 7 days)
- ✅ Missing token (request without Authorization header)

## Best Practices

1. **Never log OTP codes in production**
2. **Use HTTPS in production** (OTP sent over network)
3. **Implement rate limiting** at API gateway level
4. **Monitor failed attempts** for security alerts
5. **Consider 2FA** for sensitive operations
6. **Use httpOnly cookies** for token storage in production
7. **Implement refresh tokens** for long-lived sessions

## Troubleshooting

### OTP not received
- Check console logs (dev mode)
- Verify email service configuration
- Check spam folder
- Verify email address

### OTP verification fails
- Check OTP expiration (10 min limit)
- Verify attempt count (< 5)
- Ensure correct email/phone used
- Check hash comparison logic

### Token invalid
- Verify JWT_SECRET matches
- Check token expiration
- Ensure user exists in database
- Verify token format (Bearer <token>)

