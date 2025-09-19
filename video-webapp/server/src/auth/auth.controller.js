import { getDb } from '../db.js';
import { AppError, AuthenticationError } from '../utils/errors.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken } from './jwt.js';

export const register = async (req, res) => {
  const { username, password } = req.validatedBody;
  const db = await getDb();
  const existing = await db.get('SELECT id FROM users WHERE username = ?', username);
  if (existing) {
    throw new AppError('Username already taken', 409, 'USERNAME_TAKEN');
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const result = await db.run(
    'INSERT INTO users (username, passwordHash, createdAt) VALUES (?, ?, ?)',
    username,
    passwordHash,
    now
  );

  const user = { id: result.lastID, username };
  res.status(201).json({ user });
};

export const login = async (req, res) => {
  const { username, password } = req.validatedBody;
  const db = await getDb();
  const row = await db.get('SELECT * FROM users WHERE username = ?', username);
  if (!row) {
    throw new AuthenticationError('Invalid username or password');
  }

  const valid = await verifyPassword(password, row.passwordHash);
  if (!valid) {
    throw new AuthenticationError('Invalid username or password');
  }

  const user = { id: row.id, username: row.username };
  const token = signToken(user);
  res.json({ token, user });
};

export const me = async (req, res) => {
  res.json({ user: req.user });
};
