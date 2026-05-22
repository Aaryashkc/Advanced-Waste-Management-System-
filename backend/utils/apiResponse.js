import { isAppError } from "./httpErrors.js";

export function sendSuccess(res, payload = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    ...payload,
  });
}

export function sendError(res, error, fallbackMessage = "Internal server error") {
  const statusCode = error?.statusCode || error?.status || 500;
  const message = isAppError(error) ? error.message : fallbackMessage;

  return res.status(statusCode).json({
    success: false,
    message,
    ...(error?.details !== undefined && { details: error.details }),
    ...(process.env.NODE_ENV === "development" && !isAppError(error) && { error: error?.message }),
  });
}
