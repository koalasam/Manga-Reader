import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export interface AuthRequest extends Request {
  user?: { id: number; username: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.auth_token;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
    req.user = decoded;
    next();
  } catch {
    res.clearCookie('auth_token');
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export async function registerUser(req: Request, res: Response) {
  const { username, password, rememberMe = true } = req.body;
  if (!username || !password || password.length < 4) {
    res.status(400).json({ error: 'Username and password (min 4 chars) required' });
    return;
  }

  const db = getDb();
  const existing = await db.get('SELECT id FROM users WHERE username = ?', [username.trim()]);
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [
    username.trim(),
    hash,
  ]);

  issueSession(res, { id: result.lastID!, username: username.trim() }, rememberMe);
  res.json({ id: result.lastID, username: username.trim() });
}

export async function loginUser(req: Request, res: Response) {
  const { username, password, rememberMe = true } = req.body;
  const db = getDb();
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username?.trim()]);

  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  issueSession(res, { id: user.id, username: user.username }, rememberMe);
  res.json({ id: user.id, username: user.username });
}

function issueSession(res: Response, payload: { id: number; username: string }, rememberMe: boolean) {
  const expiresIn = rememberMe ? '365d' : '1d';
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn });

  res.cookie('auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    ...(rememberMe ? { maxAge: ONE_YEAR_MS } : {}),
  });
}