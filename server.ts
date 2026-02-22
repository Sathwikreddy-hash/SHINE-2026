import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('shinehub.db');
const JWT_SECRET = process.env.JWT_SECRET || 'shine-high-secret-key-2026';
const INVITE_CODE = 'SHINE2026'; // Hardcoded invite code as per requirements

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    class TEXT NOT NULL,
    section TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    profile_photo TEXT,
    role TEXT DEFAULT 'user',
    is_banned INTEGER DEFAULT 0,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER,
    following_id INTEGER,
    status TEXT DEFAULT 'accepted',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (following_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    photo_url TEXT,
    admin_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER,
    user_id INTEGER,
    role TEXT DEFAULT 'member',
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    group_id INTEGER,
    content TEXT,
    image_url TEXT,
    type TEXT NOT NULL, -- 'private' or 'group'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER,
    reported_user_id INTEGER,
    message_id INTEGER,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id),
    FOREIGN KEY (reported_user_id) REFERENCES users(id),
    FOREIGN KEY (message_id) REFERENCES messages(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    data TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    admin_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notice_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notice_id INTEGER,
    user_id INTEGER,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (notice_id) REFERENCES notices(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// Multer Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG are allowed'));
    }
  }
});

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- API Routes ---

// Registration
app.post('/api/auth/register', (req, res) => {
  const { name, class: className, section, username, password, inviteCode } = req.body;
  if (inviteCode !== INVITE_CODE) return res.status(400).json({ error: 'Invalid invite code' });
  
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const role = username === 'admin' ? 'admin' : 'user';
    const stmt = db.prepare('INSERT INTO users (name, class, section, username, password, role) VALUES (?, ?, ?, ?, ?, ?)');
    const result = stmt.run(name, className, section, username, hashedPassword, role);
    const user = { id: result.lastInsertRowid, username, name, class: className, section, role };
    const token = jwt.sign(user, JWT_SECRET);
    res.json({ token, user });
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`Login attempt for username: ${username}`);
  
  const user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  
  if (!user) {
    console.log(`User not found: ${username}`);
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  const isPasswordMatch = bcrypt.compareSync(password, user.password);
  if (!isPasswordMatch) {
    console.log(`Password mismatch for user: ${username}`);
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  if (user.is_banned) {
    console.log(`Banned user attempted login: ${username}`);
    return res.status(403).json({ error: 'Your account has been banned' });
  }
  
  // Update last login
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
  res.json({ token, user: { id: user.id, username: user.username, name: user.name, class: user.class, section: user.section, role: user.role } });
});

// Users
app.get('/api/users/me', authenticate, (req: any, res) => {
  const user = db.prepare('SELECT id, name, username, class, section, profile_photo, role FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

app.get('/api/users/suggested', authenticate, (req: any, res) => {
  const user: any = db.prepare('SELECT class, section FROM users WHERE id = ?').get(req.user.id);
  const suggested = db.prepare(`
    SELECT id, name, username, class, section, profile_photo 
    FROM users 
    WHERE id != ? 
    AND id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
    ORDER BY (class = ? AND section = ?) DESC, created_at DESC 
    LIMIT 10
  `).all(req.user.id, req.user.id, user.class, user.section);
  res.json(suggested);
});

app.get('/api/users/friends', authenticate, (req: any, res) => {
  const friends = db.prepare(`
    SELECT u.id, u.name, u.username, u.class, u.section, u.profile_photo 
    FROM users u
    JOIN follows f ON u.id = f.following_id
    WHERE f.follower_id = ?
  `).all(req.user.id);
  res.json(friends);
});

app.post('/api/users/follow/:id', authenticate, (req: any, res) => {
  try {
    db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Already following or user not found' });
  }
});

app.post('/api/users/unfollow/:id', authenticate, (req: any, res) => {
  db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, req.params.id);
  res.json({ success: true });
});

// Messages
app.get('/api/messages/private/:otherId', authenticate, (req: any, res) => {
  const messages = db.prepare(`
    SELECT m.*, u.name as sender_name 
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
  `).all(req.user.id, req.params.otherId, req.params.otherId, req.user.id);
  res.json(messages);
});

app.get('/api/messages/group/:groupId', authenticate, (req: any, res) => {
  const messages = db.prepare(`
    SELECT m.*, u.name as sender_name 
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE group_id = ?
    ORDER BY created_at ASC
  `).all(req.params.groupId);
  res.json(messages);
});

app.post('/api/messages/upload', authenticate, upload.single('image'), (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Groups
app.get('/api/groups', authenticate, (req: any, res) => {
  const groups = db.prepare(`
    SELECT g.* FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
  `).all(req.user.id);
  res.json(groups);
});

app.post('/api/groups', authenticate, (req: any, res) => {
  const { name, members } = req.body; // members is array of user IDs
  const result = db.prepare('INSERT INTO groups (name, admin_id) VALUES (?, ?)').run(name, req.user.id);
  const groupId = result.lastInsertRowid;
  
  const insertMember = db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)');
  insertMember.run(groupId, req.user.id, 'admin');
  members.forEach((memberId: number) => {
    insertMember.run(groupId, memberId, 'member');
  });
  
  res.json({ id: groupId, name });
});

// Moderation
app.post('/api/reports', authenticate, (req: any, res) => {
  const { reported_user_id, message_id, reason } = req.body;
  db.prepare('INSERT INTO reports (reporter_id, reported_user_id, message_id, reason) VALUES (?, ?, ?, ?)').run(req.user.id, reported_user_id, message_id, reason);
  res.json({ success: true });
});

// Admin Routes
app.get('/api/admin/users', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const users = db.prepare('SELECT id, name, username, class, section, role, is_banned, last_login FROM users').all();
  res.json(users);
});

app.delete('/api/admin/users/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  
  const userId = req.params.id;
  
  // Start a transaction to delete user data
  const deleteTx = db.transaction(() => {
    db.prepare('DELETE FROM follows WHERE follower_id = ? OR following_id = ?').run(userId, userId);
    db.prepare('DELETE FROM group_members WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').run(userId, userId);
    db.prepare('DELETE FROM notice_comments WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM reports WHERE reporter_id = ? OR reported_user_id = ?').run(userId, userId);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });
  
  deleteTx();
  res.json({ success: true });
});

// Notice Board Routes
app.get('/api/notices', authenticate, (req: any, res) => {
  const notices = db.prepare(`
    SELECT n.*, u.name as admin_name 
    FROM notices n
    JOIN users u ON n.admin_id = u.id
    ORDER BY created_at DESC
  `).all();
  res.json(notices);
});

app.post('/api/notices', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { title, content } = req.body;
  const result = db.prepare('INSERT INTO notices (title, content, admin_id) VALUES (?, ?, ?)').run(title, content, req.user.id);
  res.json({ id: result.lastInsertRowid, title, content });
});

app.get('/api/notices/:id/comments', authenticate, (req: any, res) => {
  const comments = db.prepare(`
    SELECT nc.*, u.name as user_name 
    FROM notice_comments nc
    JOIN users u ON nc.user_id = u.id
    WHERE notice_id = ?
    ORDER BY created_at ASC
  `).all(req.params.id);
  res.json(comments);
});

app.post('/api/notices/:id/comments', authenticate, (req: any, res) => {
  const { content } = req.body;
  const result = db.prepare('INSERT INTO notice_comments (notice_id, user_id, content) VALUES (?, ?, ?)').run(req.params.id, req.user.id, content);
  res.json({ id: result.lastInsertRowid, content });
});

app.post('/api/admin/ban/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- WebSockets ---
const clients = new Map<number, WebSocket>();

wss.on('connection', (ws, req) => {
  let userId: number | null = null;

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());
    
    if (data.type === 'auth') {
      try {
        const decoded: any = jwt.verify(data.token, JWT_SECRET);
        userId = decoded.id;
        if (userId) clients.set(userId, ws);
      } catch (err) {}
    }

    if (data.type === 'message' && userId) {
      const { receiverId, groupId, content, imageUrl, messageType } = data;
      const stmt = db.prepare('INSERT INTO messages (sender_id, receiver_id, group_id, content, image_url, type) VALUES (?, ?, ?, ?, ?, ?)');
      const result = stmt.run(userId, receiverId || null, groupId || null, content || null, imageUrl || null, messageType);
      
      const msg = {
        id: result.lastInsertRowid,
        sender_id: userId,
        receiver_id: receiverId,
        group_id: groupId,
        content,
        image_url: imageUrl,
        type: messageType,
        created_at: new Date().toISOString(),
        sender_name: db.prepare('SELECT name FROM users WHERE id = ?').get(userId).name
      };

      if (messageType === 'private' && receiverId) {
        clients.get(receiverId)?.send(JSON.stringify({ type: 'new_message', message: msg }));
        ws.send(JSON.stringify({ type: 'new_message', message: msg }));
      } else if (messageType === 'group' && groupId) {
        const members = db.prepare('SELECT user_id FROM group_members WHERE group_id = ?').all(groupId);
        members.forEach((m: any) => {
          clients.get(m.user_id)?.send(JSON.stringify({ type: 'new_message', message: msg }));
        });
      }
    }
  });

  ws.on('close', () => {
    if (userId) clients.delete(userId);
  });
});

// Vite Integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist/index.html')));
  }

  server.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
  });
}

startServer();

export default app;
