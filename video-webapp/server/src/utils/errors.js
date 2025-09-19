export class AppError extends Error {
  constructor (message, statusCode = 500, code = 'APP_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor (message, details) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor (message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor (message = 'You are not allowed to perform this action') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor (message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export const errorHandler = (err, req, res, next) => {
  const isAppError = err instanceof AppError;
  const status = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const payload = {
    error: {
      message: err.message || 'Unexpected error',
      code
    }
  };

  if (err.details) {
    payload.error.details = err.details;
  }

  if (!isAppError) {
    console.error(err);
  }

  res.status(status).json(payload);
  next();
};
