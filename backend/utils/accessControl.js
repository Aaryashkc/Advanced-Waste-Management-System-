import { ROLES } from "./roles.js";

export function sameId(a, b) {
  return a != null && b != null && a.toString() === b.toString();
}

export function isSuperAdmin(user) {
  return user?.role === ROLES.SUPER_ADMIN;
}

export function isOrgAdmin(user) {
  return user?.role === ROLES.ADMIN;
}

export function userCanAccessOrg(user, orgId) {
  if (isSuperAdmin(user)) return true;
  return isOrgAdmin(user) && sameId(user.orgId, orgId);
}

export function adminCanAccessPickup(pickup, user) {
  return userCanAccessOrg(user, pickup?.orgId);
}

export function userOwnsDocument(user, document, ownerField = "customerId") {
  return sameId(document?.[ownerField], user?._id);
}
