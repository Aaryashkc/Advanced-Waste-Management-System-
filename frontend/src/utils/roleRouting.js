/**
 * Centralized role routing configuration.
 * All role-based route permissions and nav links are defined here.
 * To add/edit role routes, update the ROLE_ROUTES map below.
 */

export const VALID_ROLES = ['super_admin', 'admin', 'customer_admin', 'driver'];

/**
 * ROLE_ROUTES — single source of truth for role-based navigation.
 * Each role maps to an array of { path, label } objects.
 * The first entry is treated as the role's "dashboard" / home route.
 */
export const ROLE_ROUTES = {
  super_admin: [
    { path: '/admin-dashboard', label: 'Dashboard' },
    { path: '/admin-dashboard/vehicles', label: 'Vehicles' },
    { path: '/admin-dashboard/zones', label: 'Zones' },
    { path: '/admin-dashboard/reports', label: 'Reports' },
  ],
  admin: [
    { path: '/admin-dashboard', label: 'Dashboard' },
    { path: '/admin-dashboard/vehicles', label: 'Vehicles' },
    { path: '/admin-dashboard/zones', label: 'Zones' },
    { path: '/admin-dashboard/reports', label: 'Reports' },
  ],
  customer_admin: [
    { path: '/customer-dashboard', label: 'Dashboard' },
    { path: '/schedule', label: 'Schedule' },
    { path: '/upload-waste', label: 'Request Pickup' },
    { path: '/about-us', label: 'About Us' },
    { path: '/contact-us', label: 'Contact Us' },
  ],
  driver: [
    { path: '/driver-dashboard', label: 'Dashboard' },
  ],
};

/**
 * Get the dashboard (home) route for a given user role.
 * Returns the first route in the role's ROLE_ROUTES array.
 * @param {string} role - User role
 * @returns {string} - Dashboard route path
 */
export const getDashboardRoute = (role) => {
  const routes = ROLE_ROUTES[role];
  return routes?.[0]?.path || '/';
};

/**
 * Check if a role has access to a route.
 * @param {string} userRole - User's role
 * @param {string} route - Route path to check
 * @returns {boolean} - Whether user has access
 */
export const hasRouteAccess = (userRole, route) => {
  const routes = ROLE_ROUTES[userRole];
  if (!routes) return false;
  return routes.some(({ path }) => route.startsWith(path));
};

/**
 * Get nav links for a given role (for Navbar rendering).
 * @param {string} role - User role
 * @returns {{ path: string, label: string }[]}
 */
export const getNavLinks = (role) => {
  return ROLE_ROUTES[role] || [];
};
