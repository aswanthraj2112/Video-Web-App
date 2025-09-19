import { ValidationError } from './errors.js';

export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
    return next(new ValidationError('Invalid request body', issues));
  }
  req.validatedBody = result.data;
  return next();
};

export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
    return next(new ValidationError('Invalid query parameters', issues));
  }
  req.validatedQuery = result.data;
  return next();
};
