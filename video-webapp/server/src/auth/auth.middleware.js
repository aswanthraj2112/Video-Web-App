import { AuthenticationError } from '../utils/errors.js';
import { verifyToken } from './jwt.js';

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return next(new AuthenticationError('Missing authentication token'));
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username
    };
    return next();
  } catch {
    return next(new AuthenticationError('Invalid or expired token'));
  }
};

export default authMiddleware;
