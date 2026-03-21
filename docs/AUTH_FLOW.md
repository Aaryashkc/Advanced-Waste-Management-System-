# Authentication Flow Documentation

## Overview

The application uses a unified authentication system that supports all user roles through a single login/signup interface. Authentication can be done via password or OTP (One-Time Password).

## User Roles

The system supports four roles:

- **`super_admin`**: System administrator with full access
- **`admin`**: Organization administrator
- **`customer_admin`**: Customer/end-user
- **`driver`**: Driver/field worker

## Authentication Methods

### 1. Password-Based Authentication

Users with a password can log in directly using email and password.

**Flow:**
1. User enters email and password on `/login` page
2. Frontend calls `POST /api/auth/login` with credentials
3. Backend validates credentials and returns JWT token + user data
4. Zustand store saves token and user to localStorage
5. App routes user to role-specific dashboard

### 2. OTP-Based Authentication

Users without a password (or preferring OTP) can use email-based OTP login.

**Flow:**
1. User enters email on `/login` page (or uses CustomerLogin component)
2. Frontend calls `POST /api/auth/request-otp` with email
3. Backend generates 6-digit OTP, hashes it, and sends via email
4. User enters OTP on `/otp-verification` page
5. Frontend calls `POST /api/auth/verify-otp` with OTP and email
6. Backend verifies OTP and returns JWT token + user data
7. Zustand store saves token and user to localStorage
8. App routes user to role-specific dashboard

## Role-Based Routing

After successful authentication, users are automatically routed to their role-specific dashboard:

| Role | Dashboard Route |
|------|----------------|
| `super_admin` | `/admin-dashboard` |
| `admin` | `/admin-dashboard` |
| `customer_admin` | `/customer-dashboard` |
| `driver` | `/driver-dashboard` |

The routing logic is centralized in `src/utils/roleRouting.js`:

```javascript
import { getDashboardRoute } from '../utils/roleRouting';

const dashboardRoute = getDashboardRoute(user.role);
navigate(dashboardRoute, { replace: true });
```

## Protected Routes

Routes are protected using the `ProtectedRoute` component, which:

1. Checks if user is authenticated
2. Validates user role against `allowedRoles` prop
3. Checks route access permissions
4. Shows appropriate error messages for unauthorized access
5. Redirects unauthenticated users to `/login`

**Example:**
```jsx
<Route
  path="/customer-dashboard"
  element={
    <ProtectedRoute allowedRoles={['customer_admin']}>
      <CustomerDashboard />
    </ProtectedRoute>
  }
/>
```

## State Management (Zustand)

Authentication state is managed using Zustand store (`src/stores/useAuthStore.js`):

**State:**
- `user`: Current user object
- `token`: JWT token
- `isAuthenticated`: Boolean authentication status
- `loading`: Loading state for async operations
- `error`: Error message if any

**Actions:**
- `login(email, password)`: Password-based login
- `loginWithOTP(otp, email, phone)`: OTP-based login
- `signup(userData)`: User registration
- `logout()`: Clear auth state
- `fetchMe()`: Fetch current user from `/api/auth/me`
- `hydrateFromStorage()`: Restore auth state from localStorage

**Persistence:**
- Token and user are persisted to localStorage using Zustand's persist middleware
- On app load, `App.jsx` hydrates the store and calls `fetchMe()` to verify token

## JWT Token Structure

JWT tokens now include both `userId` and `role`:

```json
{
  "userId": "user-id-here",
  "role": "customer_admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

This allows the backend to verify user role without additional database queries in middleware.

## Authorization Middleware

### Backend Middleware

1. **`authMiddleware`**: Validates JWT token and attaches user to `req.user`
2. **`roleMiddleware([...roles])`**: Restricts routes to specific roles

**Example:**
```javascript
router.use(authMiddleware);
router.use(roleMiddleware("admin", "super_admin"));
```

### Frontend Guards

Protected routes use `ProtectedRoute` component with `allowedRoles` prop.

## Error Handling

### Authentication Errors

- **401 Unauthorized**: Invalid credentials or expired token
- **403 Forbidden**: User doesn't have required role
- **400 Bad Request**: Missing required fields or invalid input

### Frontend Error States

- Login/signup forms show error messages
- Protected routes show access denied page with role information
- API interceptor automatically redirects to `/login` on 401

## Adding a New Role

To add a new role in the future:

1. **Backend:**
   - Add role to `User.model.js` enum: `["customer_admin", "driver", "admin", "super_admin", "new_role"]`
   - Update route files to use new role in `roleMiddleware()`

2. **Frontend:**
   - Add role mapping in `src/utils/roleRouting.js`:
     ```javascript
     const roleRoutes = {
       // ... existing roles
       new_role: '/new-role-dashboard',
     };
     ```
   - Add route access permissions:
     ```javascript
     const roleRoutes = {
       // ... existing roles
       new_role: ['/new-role-dashboard', '/other-route'],
     };
     ```
   - Create dashboard component and add protected route in `AppRoutes.jsx`

3. **Database:**
   - Update existing users if needed (migration script)

## Security Considerations

1. **Password Hashing**: Uses bcrypt with salt rounds of 10
2. **OTP Security**: OTP is hashed using SHA-256 before storage
3. **JWT Expiration**: Tokens expire after 7 days (configurable via `JWT_EXPIRES_IN`)
4. **OTP Expiration**: OTP expires after 10 minutes
5. **OTP Attempts**: Maximum 5 verification attempts per OTP
6. **Rate Limiting**: 60-second cooldown between OTP requests

## Testing Authentication

### Manual Testing

1. **Password Login:**
   - Navigate to `/login`
   - Enter email and password
   - Verify redirect to correct dashboard

2. **OTP Login:**
   - Navigate to `/login` (or use CustomerLogin component)
   - Enter email, request OTP
   - Enter OTP on verification page
   - Verify redirect to correct dashboard

3. **Protected Routes:**
   - Try accessing `/admin-dashboard` as `customer_admin` (should show access denied)
   - Try accessing `/customer-dashboard` as `driver` (should show access denied)

4. **Token Persistence:**
   - Log in, refresh page
   - Verify user remains authenticated
   - Verify redirect to correct dashboard

### API Testing

```bash
# Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Get current user
curl -X GET http://localhost:5001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

