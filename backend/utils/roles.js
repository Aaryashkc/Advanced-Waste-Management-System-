export const ROLES = Object.freeze({
  CUSTOMER_ADMIN: "customer_admin",
  DRIVER: "driver",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
});

export const ALL_ROLES = Object.freeze(Object.values(ROLES));
const ROLE_SET = new Set(ALL_ROLES);

export function isValidRole(role) {
  return ROLE_SET.has(role);
}

export function assertValidRoles(roles) {
  const invalid = roles.filter((role) => !isValidRole(role));
  if (invalid.length > 0) {
    throw new Error(`Invalid role(s) configured: ${invalid.join(", ")}`);
  }
}
