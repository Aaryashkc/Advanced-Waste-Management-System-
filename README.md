# Waste Management System

A full-stack waste management application with OTP-based authentication, schedule management, and waste collection tracking.

## Project Structure

```
maskey/
├── backend/          # Node.js/Express backend
├── frontend/         # React/Vite frontend
└── package.json      # Root package.json
```

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

## Environment Variables

### Backend (.env in root directory)

Create a `.env` file in the root directory:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URL=mongodb://localhost:27017/waste-management

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Email Service (optional - for production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@wastemanagement.com

# Cloudinary (required for waste image uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Optional: protect cron cleanup endpoint (set to a secret string)
# CRON_SECRET=your-cron-secret
```

### Frontend (.env in frontend directory)

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Installation & Setup

### 1. Install Dependencies

From the root directory:

```bash
npm install
cd frontend
npm install
cd ..
```

### 2. Start Backend

```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

The backend will run on `http://localhost:5000`

### 3. Start Frontend

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:5173`

## API Endpoints

### Authentication

#### Request OTP
```http
POST /api/auth/request-otp
Content-Type: application/json

{
  "email": "user@example.com"
  // OR
  "phone": "+1234567890"
}
```

#### Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
```

Response:
```json
{
  "message": "OTP verified successfully",
  "accessToken": "jwt-token-here",
  "user": {
    "id": "user-id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "USER"
  }
}
```

#### Register (Password-based)
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "role": "USER"
}
```

#### Login (Password-based)
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword"
}
```

### Schedule

#### Get All Schedules
```http
GET /api/schedule?city=Kathmandu&area=Maitidevi&day=Monday
```

#### Get Schedule by ID
```http
GET /api/schedule/:id
```

#### Create Schedule (Protected)
```http
POST /api/schedule
Authorization: Bearer <token>
Content-Type: application/json

{
  "city": "Kathmandu",
  "area": "Maitidevi",
  "truckId": "truck-id",
  "driverId": "driver-id",
  "day": "Monday",
  "time": "~7:00 am",
  "truckType": "light duty",
  "orgId": "org-id"
}
```

## Cloudinary image uploads

Customer waste images are uploaded to Cloudinary and metadata is stored in MongoDB. Uploads are automatically deleted after 30 days to optimize storage.

### Required env vars (backend)

- `CLOUDINARY_CLOUD_NAME` – from Cloudinary dashboard
- `CLOUDINARY_API_KEY` – from Cloudinary dashboard
- `CLOUDINARY_API_SECRET` – from Cloudinary dashboard

Optional: `CRON_SECRET` – if set, the cleanup cron HTTP endpoint requires `?secret=<CRON_SECRET>`.

### How cleanup works

- A **node-cron** job runs daily at **2:00 AM** (server local time).
- Records with `expiresAt <= now` are processed: each asset is deleted from Cloudinary, then the MongoDB record is removed.
- If Cloudinary delete fails for a record, the DB record is **not** deleted and the error is logged (idempotent; safe to rerun).
- Only one cron schedule is registered per process so hot reload (e.g. nodemon) does not spawn duplicate jobs.
- You can also trigger cleanup via HTTP: `GET /api/cron/cleanup-uploads?secret=<CRON_SECRET>` (if `CRON_SECRET` is set).

### How to test upload and deletion locally

1. Set the three Cloudinary env vars in `.env` and restart the backend.
2. Log in as a customer, go to **Upload Waste**, choose category/level, select a JPEG/PNG/WebP image (≤ 5MB), and submit. Confirm the image appears in Cloudinary under `waste_uploads/<userId>/` and that the UI shows the uploaded image URL after success.
3. To test cleanup without waiting 30 days: in MongoDB, set one record’s `expiresAt` to a past date (e.g. `db.wasteuploads.updateOne({}, { $set: { expiresAt: new Date('2000-01-01') } })`), then call `GET /api/cron/cleanup-uploads` (with `?secret=...` if you set `CRON_SECRET`). Confirm the asset is removed from Cloudinary and the record is deleted from MongoDB. Check server logs for the cleanup summary (e.g. `Cleanup: expired=1 cloudDeleted=1 dbDeleted=1 errors=0`).

## OTP Authentication Flow

1. User enters email on login page
2. Frontend calls `POST /api/auth/request-otp` with email
3. Backend generates 6-digit OTP, hashes it, stores in database
4. Backend sends OTP via email (console log in dev mode)
5. User enters OTP on verification page
6. Frontend calls `POST /api/auth/verify-otp` with email and OTP
7. Backend verifies OTP (checks hash, expiration, attempts)
8. On success, backend returns JWT token and user data
9. Frontend stores token and redirects to dashboard

See `docs/auth-flow.md` for detailed documentation.

## Security Features

- OTP is hashed using SHA-256 before storage
- OTP expires after 10 minutes
- Maximum 5 verification attempts per OTP
- 60-second cooldown between OTP requests
- JWT tokens for authenticated requests
- CORS configured for frontend origin

## Modules Added

- **OTP Authentication System**: Complete OTP request/verify flow
- **Schedule Module**: CRUD operations for waste collection schedules
- **Email Service**: Placeholder for email integration (logs to console in dev)

## Development Notes

- OTP codes are logged to console in development mode
- Email service needs integration with actual SMTP provider for production
- Schedule module is scaffolded but not yet integrated with frontend

## Troubleshooting

### Backend won't start
- Check MongoDB connection string in `.env`
- Ensure MongoDB is running
- Check if port 5000 is available

### Frontend can't connect to backend
- Verify `VITE_API_BASE_URL` in frontend `.env`
- Check CORS settings in `backend/server.js`
- Ensure backend is running

### OTP not received
- In development, check console logs for OTP code
- Verify email service configuration
- Check spam folder if using real email service

## Next Steps

- [ ] Integrate real email service (SendGrid, AWS SES, etc.)
- [ ] Add SMS OTP support
- [ ] Connect schedule frontend to backend API
- [ ] Add request/waste upload endpoints
- [ ] Implement driver task assignment
- [ ] Add admin dashboard features

## License

ISC

