import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import { AuthenticationError, ForbiddenError } from "../utils/httpErrors.js";
import { updateRequestContext } from "../utils/observability.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      throw new AuthenticationError("Authentication required");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-passwordHash -loginOtp -twoFactor.secret");

    if (!user) {
      throw new AuthenticationError("User not found");
    }

    if (user.isActive === false) {
      throw new ForbiddenError("User account is disabled");
    }

    req.user = user;
    updateRequestContext({ userId: user._id, orgId: user.orgId });
    next();
  } catch (error) {
    next(
      error instanceof AuthenticationError || error instanceof ForbiddenError
        ? error
        : new AuthenticationError("Invalid or expired token")
    );
  }
};
