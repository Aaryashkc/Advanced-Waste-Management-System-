import { Navigate } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import { VALID_ROLES } from '../../utils/roleRouting';

/**
 * ProtectedRoute — guards routes based on authentication and role.
 * @param {React.ReactNode} children - The component to render if access is granted
 * @param {string[]} allowedRoles - Roles that can access this route (optional)
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user, loading, logout } = useAuthStore();

  // Show loading spinner while auth state initializes
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f1e8]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#354f52] mx-auto" />
          <p className="mt-4 text-gray-600 font-['Poppins',sans-serif]">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated → redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but user data missing → force logout
  if (!user) {
    logout();
    return <Navigate to="/login" replace />;
  }

  // Unknown / invalid role → auto-logout + redirect to login
  if (!VALID_ROLES.includes(user.role)) {
    logout();
    return <Navigate to="/login" replace />;
  }

  // Role not in allowedRoles → redirect to /unauthorized
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
