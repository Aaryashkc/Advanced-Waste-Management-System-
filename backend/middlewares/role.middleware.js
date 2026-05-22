import { AuthenticationError, ForbiddenError } from "../utils/httpErrors.js";
import { assertValidRoles } from "../utils/roles.js";

export const roleMiddleware = (...allowedRoles) => {
  assertValidRoles(allowedRoles);

  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError("Authentication required"));
    }

    if (req.user.isActive === false) {
      return next(new ForbiddenError("User account is disabled"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError("Access denied. Insufficient permissions"));
    }

    next();
  };
};

