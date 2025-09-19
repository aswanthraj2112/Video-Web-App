import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const resolveFromRoot = (maybeRelative) =>
  path.isAbsolute(maybeRelative)
    ? maybeRelative
    : path.resolve(rootDir, maybeRelative);

const config = {
  PORT: Number.parseInt(process.env.PORT || '4000', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'change_me',
  TOKEN_EXPIRY: process.env.TOKEN_EXPIRY || '1h',
  DB_FILE: resolveFromRoot(process.env.DB_FILE || './data.sqlite'),
  PUBLIC_DIR: resolveFromRoot(process.env.PUBLIC_DIR || './src/public'),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  LIMIT_FILE_SIZE_MB: Number.parseInt(process.env.LIMIT_FILE_SIZE_MB || '512', 10)
};

config.PUBLIC_VIDEOS_DIR = path.join(config.PUBLIC_DIR, 'videos');
config.PUBLIC_THUMBS_DIR = path.join(config.PUBLIC_DIR, 'thumbs');

export default config;
