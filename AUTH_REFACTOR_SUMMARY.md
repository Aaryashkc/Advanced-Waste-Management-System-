# Authentication Refactor Summary

## Overview
This document summarizes the changes made to unify authentication across all user roles, remove the separate admin-login flow, and implement Zustand-based state management.

## Files Changed

### Backend Changes

1. **`backend/models/User.model.js`**
   - Updated role enum from `["USER", "DRIVER", "ORG_ADMIN", "SUPER_ADMIN"]` to `["customer_admin", "driver", "admin", "super_admin"]`
   - Changed default role from `"USER"` to `"customer_admin"`

2. **`backend/config/jwt.config.js`**
   - Updated `generateToken()` to include `role` in JWT payload
   - Token now contains: `{ userId, role }`

3. **`backend/controllers/auth.controller.js`**
   - Updated all role references to use new role names
   - Updated `register()`, `login()`, and `verifyOTP()` to include role in JWT token generation
   - Standardized response format: all endpoints return `token` (not `accessToken`)
   - Added `getMe()` endpoint to fetch current authenticated user
   - Updated user object in responses to include `phone` and `orgId`

4. **`backend/routes/auth.route.js`**
   - Added `GET /api/auth/me` endpoint (protected by authMiddleware)

5. **`backend/middlewares/auth.middleware.js`**
   - No changes needed - already works with JWT containing role

6. **`backend/middlewares/role.middleware.js`**
   - No changes needed - works with any role names

7. **`backend/routes/user.route.js`**
   - Updated role check from `"USER"` to `"customer_admin"`

8. **`backend/routes/driver.route.js`**
   - Updated role check from `"DRIVER"` to `"driver"`

9. **`backend/routes/orgAdmin.route.js`**
   - Updated role check from `"ORG_ADMIN"` to `"admin"`

10. **`backend/routes/superAdmin.route.js`**
    - Updated role check from `"SUPER_ADMIN"` to `"super_admin"`

11. **`backend/controllers/orgAdmin.controller.js`**
    - Updated role references: `"ORG_ADMIN"` → `"admin"`, `"DRIVER"` → `"driver"`
    - Fixed bug: changed `password` to `passwordHash` in user creation

### Frontend Changes

1. **`frontend/src/stores/useAuthStore.js`** (NEW)
   - Created Zustand store for authentication state management
   - Includes: `user`, `token`, `isAuthenticated`, `loading`, `error`
   - Actions: `login()`, `loginWithOTP()`, `signup()`, `logout()`, `fetchMe()`, `hydrateFromStorage()`, `clearError()`
   - Persists token and user to localStorage using Zustand persist middleware

2. **`frontend/src/utils/roleRouting.js`** (NEW)
   - Helper functions for role-based routing
   - `getDashboardRoute(role)`: Returns dashboard route for a role
   - `hasRouteAccess(userRole, route)`: Checks if user has access to a route

3. **`frontend/src/utils/api.js`**
   - Updated request interceptor to get token from Zustand store (with localStorage fallback)
   - Updated response interceptor to clear Zustand storage on 401
   - Added `getMe()` method to authAPI

4. **`frontend/src/pages/Login.jsx`**
   - Updated to use Zustand store instead of direct navigation
   - Removed hardcoded admin-specific text
   - Added role-based routing after successful login
   - Added error handling and loading states

5. **`frontend/src/components/auth/CustomerLogin.jsx`**
   - Added Zustand store integration
   - Added redirect if already authenticated
   - Uses role-based routing (via OTP flow)

6. **`frontend/src/components/auth/OTPVerificationPage.jsx`**
   - Updated to use Zustand `loginWithOTP()` instead of direct API calls
   - Removed localStorage.setItem calls (handled by Zustand)
   - Added role-based routing after successful OTP verification
   - Changed from `accessToken` to `token` in response handling

7. **`frontend/src/components/auth/CustomerSignup.jsx`**
   - Updated to use Zustand `signup()` action
   - Added password field (optional - for password-based signup)
   - Falls back to OTP flow if password not provided
   - Added role-based routing after successful signup

8. **`frontend/src/components/auth/ProtectedRoute.jsx`** (NEW)
   - Created protected route component with role-based access control
   - Supports `allowedRoles` prop for role restrictions
   - Shows appropriate error messages for unauthorized access
   - Redirects unauthenticated users to `/login`

9. **`frontend/src/routes/AppRoutes.jsx`**
   - **REMOVED**: `/admin-login` route
   - Updated `/login` to use unified `Login` component
   - Added `ProtectedRoute` guards to all protected routes:
     - Customer admin routes: `/customer-landing`, `/customer-dashboard`, `/schedule`, `/upload-waste`, `/searching`
     - Driver routes: `/driver-dashboard`, `/accept-task`, `/task-route`, `/task-flow`
     - Admin routes: `/admin-dashboard` (for `super_admin` and `admin`)

10. **`frontend/src/App.jsx`**
    - Added `useEffect` to hydrate auth store from localStorage on mount
    - Calls `fetchMe()` if token exists to verify and refresh user data

11. **`frontend/src/components/dashboard/Topbar.jsx`**
    - Updated to use Zustand `logout()` action
    - Changed logout redirect from `/admin-login` to `/login`
    - Uses user data from Zustand store

## Role Mapping

| Old Role | New Role | Dashboard Route |
|----------|----------|----------------|
| `USER` | `customer_admin` | `/customer-dashboard` |
| `DRIVER` | `driver` | `/driver-dashboard` |
| `ORG_ADMIN` | `admin` | `/admin-dashboard` |
| `SUPER_ADMIN` | `super_admin` | `/admin-dashboard` |

## API Endpoints

### Authentication Endpoints (All Roles)
- `POST /api/auth/register` - Register new user (password-based)
- `POST /api/auth/login` - Login with email/password (all roles)
- `POST /api/auth/request-otp` - Request OTP for login
- `POST /api/auth/verify-otp` - Verify OTP and login
- `GET /api/auth/me` - Get current authenticated user (protected)

### Response Format
All auth endpoints return consistent format:
```json
{
  "message": "Success message",
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "name": "User Name",
    "email": "user@example.com",
    "phone": "phone-number",
    "role": "customer_admin",
    "orgId": "org-id"
  }
}
```

## Database Migration Notes

⚠️ **IMPORTANT**: Existing users in the database have old role values. You need to migrate them:

```javascript
// Migration script (run in MongoDB shell or migration tool)
db.users.updateMany(
  { role: "USER" },
  { $set: { role: "customer_admin" } }
);
db.users.updateMany(
  { role: "DRIVER" },
  { $set: { role: "driver" } }
);
db.users.updateMany(
  { role: "ORG_ADMIN" },
  { $set: { role: "admin" } }
);
db.users.updateMany(
  { role: "SUPER_ADMIN" },
  { $set: { role: "super_admin" } }
);
```

## Testing Checklist

- [ ] Test login with password for each role
- [ ] Test OTP login flow for each role
- [ ] Test signup (password-based and OTP-based)
- [ ] Test role-based routing after login
- [ ] Test protected routes with correct roles
- [ ] Test protected routes with incorrect roles (should show access denied)
- [ ] Test logout functionality
- [ ] Test token persistence and rehydration on page reload
- [ ] Test `/auth/me` endpoint
- [ ] Test JWT token includes role

## Breaking Changes

1. **Role Names**: All role names have changed. Update any hardcoded role checks.
2. **Admin Login Route**: `/admin-login` route has been removed. All users now use `/login`.
3. **JWT Token**: Now includes `role` in payload. Old tokens will need to be regenerated.
4. **API Response**: OTP verification now returns `token` instead of `accessToken` (for consistency).

## Next Steps

1. Run database migration to update existing user roles
2. Test all authentication flows
3. Update any frontend components that reference old role names
4. Update any backend code that references old role names
5. Clear old localStorage tokens (users will need to log in again)

