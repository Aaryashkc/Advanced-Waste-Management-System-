import { isAppError } from "./httpErrors.js";

function normalizeSuccessPayload(payload, statusCode) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const { success, ...body } = payload;
    return {
      success: statusCode < 400,
      ...body,
    };
  }

  return {
    success: statusCode < 400,
    data: payload ?? null,
  };
}

function normalizeErrorPayload(payload, statusCode) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const { success, ...body } = payload;
    return {
      success: false,
      ...body,
    };
  }

  return {
    success: false,
    message: payload || "Request failed",
    statusCode,
  };
}

export function normalizeApiResponse(payload, statusCode = 200) {
  return statusCode >= 400
    ? normalizeErrorPayload(payload, statusCode)
    : normalizeSuccessPayload(payload, statusCode);
}

export function apiResponseMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = (payload) => originalJson(normalizeApiResponse(payload, res.statusCode));

  next();
}

export function sendSuccess(res, payload = {}, statusCode = 200) {
  return res.status(statusCode).json(normalizeSuccessPayload(payload, statusCode));
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
