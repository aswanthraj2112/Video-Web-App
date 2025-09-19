import jwt from 'jsonwebtoken';
import config from '../config.js';

export function signToken (user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username
    },
    config.JWT_SECRET,
    { expiresIn: config.TOKEN_EXPIRY, algorithm: 'HS256' }
  );
}

export function verifyToken (token) {
  return jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
}
