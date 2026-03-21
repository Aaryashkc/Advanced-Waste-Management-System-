# Changes Log

This document tracks all files modified, added, or changed during the OTP authentication integration and backend scaffolding.

## Files Added

### Backend

1. **`backend/utils/otp.utils.js`** (NEW)
   - OTP generation, hashing, and verification utilities
   - Functions: `generateOTP()`, `hashOTP()`, `verifyOTP()`, `isOTPExpired()`, `getOTPExpiration()`, `canResendOTP()`, `isAttemptLimitExceeded()`

2. **`backend/models/Schedule.model.js`** (NEW)
   - Mongoose model for waste collection schedules
   - Fields: city, area, truckId, driverId, day, time, truckType, isActive, orgId
   - Indexes for efficient queries

3. **`backend/controllers/schedule.controller.js`** (NEW)
   - CRUD operations for schedules
   - Functions: `getSchedules()`, `getScheduleById()`, `createSchedule()`, `updateSchedule()`, `deleteSchedule()`

4. **`backend/routes/schedule.route.js`** (NEW)
   - Express routes for schedule endpoints
   - Public routes: GET `/api/schedule`, GET `/api/schedule/:id`
   - Protected routes: POST, PUT, DELETE (require authentication)

### Frontend

5. **`frontend/src/utils/api.js`** (NEW)
   - Axios-based API client
   - Auth API methods: `requestOTP()`, `verifyOTP()`, `register()`, `login()`
   - Request/response interceptors for token management
   - Automatic token injection and error handling

### Documentation

6. **`README.md`** (NEW - root)
   - Project setup instructions
   - Environment variables documentation
   - API endpoint examples
   - Troubleshooting guide

7. **`docs/changes.md`** (THIS FILE)
   - Complete change log

8. **`docs/auth-flow.md`** (NEW)
   - Detailed OTP authentication flow documentation
   - Security measures explanation
   - Token structure

## Files Modified

### Backend

1. **`backend/services/emailService.js`** (MODIFIED)
   - **Before**: Empty file
   - **After**: Implemented `sendOTPEmail()` and `sendOTPSMS()` functions
   - Currently logs to console in dev mode, ready for SMTP integration

2. **`backend/controllers/auth.controller.js`** (MODIFIED)
   - **Added**: `requestOTP()` function
     - Generates and hashes OTP
     - Stores in user's `loginOtp` field
     - Sends via email/SMS
     - Implements cooldown period
   - **Added**: `verifyOTP()` function
     - Verifies OTP hash
     - Checks expiration and attempt limits
     - Generates JWT token on success
     - Clears OTP after successful verification
   - **Modified**: `login()` function
     - Fixed to use `passwordHash` instead of `password`
     - Added check for OTP-only users
   - **Modified**: `register()` function
     - Fixed to use `passwordHash` instead of `password`

3. **`backend/routes/auth.route.js`** (MODIFIED)
   - **Added**: `POST /api/auth/request-otp` route
   - **Added**: `POST /api/auth/verify-otp` route

4. **`backend/server.js`** (MODIFIED)
   - **Added**: Schedule routes (`/api/schedule`)
   - **Modified**: CORS configuration
     - **Before**: `app.use(cors())`
     - **After**: Configured with frontend URL, credentials, and allowed methods/headers

### Frontend

5. **`frontend/src/components/auth/CustomerLogin.jsx`** (MODIFIED)
   - **Before**: Mock login with setTimeout
   - **After**: 
     - Imports `authAPI` from utils
     - Calls `authAPI.requestOTP(email)` on login
     - Stores email in sessionStorage for OTP page
     - Proper error handling

6. **`frontend/src/components/auth/OTPVerificationPage.jsx`** (MODIFIED)
   - **Before**: Mock verification, commented out API calls
   - **After**:
     - Imports `authAPI` from utils
     - Calls `authAPI.verifyOTP(otp, email)` on verify
     - Stores token and user data in localStorage
     - Implements resend OTP functionality
     - Proper error handling with user feedback

## API Contract Changes

### New Endpoints

#### `POST /api/auth/request-otp`
**Request:**
```json
{
  "email": "user@example.com"
  // OR
  "phone": "+1234567890"
}
```

**Response (200):**
```json
{
  "message": "OTP sent successfully"
}
```

**Response (429 - Rate Limited):**
```json
{
  "message": "Please wait before requesting a new OTP",
  "retryAfter": 45
}
```

#### `POST /api/auth/verify-otp`
**Request:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "message": "OTP verified successfully",
  "accessToken": "jwt-token",
  "user": {
    "id": "user-id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "USER"
  }
}
```

**Response (401 - Invalid OTP):**
```json
{
  "message": "Invalid OTP",
  "remainingAttempts": 3
}
```

### Modified Endpoints

#### `POST /api/auth/login`
**No contract change**, but internal fix:
- Now checks `passwordHash` field instead of `password`
- Returns error for OTP-only users

#### `POST /api/auth/register`
**No contract change**, but internal fix:
- Now stores password in `passwordHash` field

## Database Schema Changes

### User Model
- **No schema changes** - `loginOtp` field already existed in schema
- Now actively used with:
  - `hash`: SHA-256 hashed OTP
  - `expiresAt`: Expiration timestamp
  - `attempts`: Verification attempt counter
  - `lastSentAt`: Last OTP request timestamp

### New Collections
- **Schedule**: New collection for waste collection schedules

## Environment Variables Added

### Backend
- `FRONTEND_URL`: Frontend URL for CORS (default: `http://localhost:5173`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`: For email service (optional)

### Frontend
- `VITE_API_BASE_URL`: Backend API base URL (default: `http://localhost:5000/api`)

## Security Improvements

1. **OTP Hashing**: OTPs are hashed using SHA-256 before storage
2. **OTP Expiration**: 10-minute expiration window
3. **Attempt Limiting**: Maximum 5 verification attempts per OTP
4. **Rate Limiting**: 60-second cooldown between OTP requests
5. **Token Management**: JWT tokens stored securely, automatic cleanup on 401

## Breaking Changes

**None** - All changes are additive. Existing password-based login still works.

## Migration Notes

1. **No database migration required** - User model already had `loginOtp` schema
2. **Environment variables** - Add new env vars as documented in README
3. **Frontend** - Update `.env` file with `VITE_API_BASE_URL`

## Testing Notes

- OTP codes are logged to console in development mode
- In production, integrate real email/SMS service
- Test OTP expiration by waiting 10+ minutes
- Test attempt limits by entering wrong OTP 5 times
- Test rate limiting by requesting OTP multiple times within 60 seconds

