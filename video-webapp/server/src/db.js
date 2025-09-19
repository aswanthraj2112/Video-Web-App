import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs/promises';
import path from 'path';
import config from './config.js';

sqlite3.verbose();

const dbPromise = open({
  filename: config.DB_FILE,
  driver: sqlite3.Database
});

export const getDb = () => dbPromise;

export async function initDb () {
  await fs.mkdir(path.dirname(config.DB_FILE), { recursive: true }).catch(() => {});
  const db = await dbPromise;
  await db.exec('PRAGMA foreign_keys = ON;');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      originalName TEXT NOT NULL,
      storedFilename TEXT NOT NULL,
      format TEXT,
      durationSec REAL,
      status TEXT NOT NULL DEFAULT 'uploaded',
      width INTEGER,
      height INTEGER,
      sizeBytes INTEGER,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      thumbPath TEXT,
      transcodedFilename TEXT,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

if (process.argv.includes('--init')) {
  initDb()
    .then(() => {
      console.log('Database initialized at', config.DB_FILE);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to initialize database', err);
      process.exit(1);
    });
}

export default dbPromise;
