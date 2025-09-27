import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthenticationError } from '../utils/errors.js';
import { getConfig } from '../config.js';

const jwkSets = new Map();

const buildIssuer = (region, userPoolId) =>
  `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

const getJwkSet = (issuer) => {
  if (!jwkSets.has(issuer)) {
    jwkSets.set(issuer, createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)));
  }
  return jwkSets.get(issuer);
};

const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
};

const authMiddleware = async (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    return next(new AuthenticationError('Missing authentication token'));
  }

  try {
    const config = getConfig();
    const issuer = buildIssuer(config.REGION, config.COGNITO_USER_POOL_ID);
    const jwkSet = getJwkSet(issuer);
    const { payload } = await jwtVerify(token, jwkSet, {
      issuer,
      audience: config.COGNITO_CLIENT_ID
    });

    req.user = {
      id: payload.sub,
      username: payload['cognito:username'] || payload.username || payload.email || payload.sub,
      email: payload.email || null,
      token,
      claims: payload
    };
    return next();
  } catch (error) {
    console.error('JWT validation failed', error);
    return next(new AuthenticationError('Invalid or expired token'));
  }
};

export default authMiddleware;
