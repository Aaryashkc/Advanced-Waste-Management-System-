export class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.status = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details = undefined) {
    super(message, 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required", details = undefined) {
    super(message, 401, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied", details = undefined) {
    super(message, 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details = undefined) {
    super(message, 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details = undefined) {
    super(message, 409, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service unavailable", details = undefined) {
    super(message, 503, details);
  }
}

export function isAppError(error) {
  return error instanceof AppError || Number.isInteger(error?.statusCode) || Number.isInteger(error?.status);
}
