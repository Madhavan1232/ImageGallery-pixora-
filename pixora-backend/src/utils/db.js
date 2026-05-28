const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../db/database.json');

let pool = null;
let initPromise = null;

function hasMysqlConfig() {
  return Boolean(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE);
}

function getMysqlConfig() {
  return {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  };
}

async function ensureMysqlDatabase(config) {
  const adminConnection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
  });

  await adminConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await adminConnection.end();
}

async function ensureMysqlSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      avatar TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      banned TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      INDEX idx_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS likes (
      user_id VARCHAR(36) NOT NULL,
      image_id VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, image_id),
      CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS like_data (
      user_id VARCHAR(36) NOT NULL,
      image_id VARCHAR(255) NOT NULL,
      image_data LONGTEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, image_id),
      CONSTRAINT fk_like_data_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      user_id VARCHAR(36) NOT NULL,
      image_id VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, image_id),
      CONSTRAINT fk_bookmarks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookmark_data (
      user_id VARCHAR(36) NOT NULL,
      image_id VARCHAR(255) NOT NULL,
      image_data LONGTEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, image_id),
      CONSTRAINT fk_bookmark_data_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS follows (
      follower_id VARCHAR(36) NOT NULL,
      following_id VARCHAR(36) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, following_id),
      CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_follows_following FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id VARCHAR(36) PRIMARY KEY,
      image_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activities (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      type VARCHAR(80) NOT NULL,
      payload LONGTEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS images (
      id VARCHAR(255) PRIMARY KEY,
      owner_id VARCHAR(36) NOT NULL,
      url TEXT NOT NULL,
      thumb TEXT,
      full TEXT,
      width INT,
      height INT,
      description TEXT,
      likes INT DEFAULT 0,
      tags LONGTEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_images_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id VARCHAR(36) PRIMARY KEY,
      reporter_id VARCHAR(36) NOT NULL,
      target_type VARCHAR(20) NOT NULL,
      target_id VARCHAR(255) NOT NULL,
      reason TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ensure users table has role and banned columns on older schemas
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'`);
  } catch (e) {
    // some MySQL versions don't support IF NOT EXISTS in ALTER; ignore
  }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned TINYINT(1) NOT NULL DEFAULT 0`);
  } catch (e) {
    // ignore
  }
}

function ensureJsonDb() {
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initial = { 
      users: [],
      likes: {},
      likeData: {},
      bookmarks: {},
      bookmarkData: {},
      followers: {},
      following: {},
      images: [],
      comments: {},
      activities: {},
      reports: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
  }
}

function normalizeJsonDb(db) {
  return {
    users: Array.isArray(db.users) ? db.users : [],
    likes: db.likes && typeof db.likes === 'object' ? db.likes : {},
    likeData: db.likeData && typeof db.likeData === 'object' ? db.likeData : {},
    bookmarks: db.bookmarks && typeof db.bookmarks === 'object' ? db.bookmarks : {},
    bookmarkData: db.bookmarkData && typeof db.bookmarkData === 'object' ? db.bookmarkData : {},
    followers: db.followers && typeof db.followers === 'object' ? db.followers : {},
    following: db.following && typeof db.following === 'object' ? db.following : {},
    images: Array.isArray(db.images) ? db.images : [],
    comments: db.comments && typeof db.comments === 'object' ? db.comments : {},
    activities: db.activities && typeof db.activities === 'object' ? db.activities : {},
    reports: Array.isArray(db.reports) ? db.reports : [],
  };
}

async function initDB() {
  if (initPromise) return initPromise;

  if (!hasMysqlConfig()) {
    ensureJsonDb();
    initPromise = Promise.resolve({ mode: 'json' });
    return initPromise;
  }

  initPromise = (async () => {
    const config = getMysqlConfig();
    await ensureMysqlDatabase(config);
    pool = mysql.createPool(config);
    await ensureMysqlSchema();
    return { mode: 'mysql' };
  })();

  return initPromise;
}

async function readDB() {
  if (!hasMysqlConfig()) {
    ensureJsonDb();
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return normalizeJsonDb(JSON.parse(raw));
  }

  await initDB();
  const [users, likes, likeData, bookmarks, bookmarkData] = await Promise.all([
    pool.query('SELECT id, username, email, password, avatar, created_at AS createdAt FROM users'),
    pool.query('SELECT user_id, image_id FROM likes'),
    pool.query('SELECT user_id, image_id, image_data FROM like_data'),
    pool.query('SELECT user_id, image_id FROM bookmarks'),
    pool.query('SELECT user_id, image_id, image_data FROM bookmark_data'),
  ]);

  const db = { users: users[0], likes: {}, likeData: {}, bookmarks: {}, bookmarkData: {} };

  for (const row of likes[0]) {
    if (!db.likes[row.user_id]) db.likes[row.user_id] = [];
    db.likes[row.user_id].push(row.image_id);
  }

  for (const row of likeData[0]) {
    if (!db.likeData[row.user_id]) db.likeData[row.user_id] = {};
    try {
      db.likeData[row.user_id][row.image_id] = row.image_data ? JSON.parse(row.image_data) : null;
    } catch {
      db.likeData[row.user_id][row.image_id] = row.image_data;
    }
  }

  for (const row of bookmarks[0]) {
    if (!db.bookmarks[row.user_id]) db.bookmarks[row.user_id] = [];
    db.bookmarks[row.user_id].push(row.image_id);
  }

  for (const row of bookmarkData[0]) {
    if (!db.bookmarkData[row.user_id]) db.bookmarkData[row.user_id] = {};
    try {
      db.bookmarkData[row.user_id][row.image_id] = row.image_data ? JSON.parse(row.image_data) : null;
    } catch {
      db.bookmarkData[row.user_id][row.image_id] = row.image_data;
    }
  }

  return db;
}

async function writeDB(data) {
  if (!hasMysqlConfig()) {
    ensureJsonDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return;
  }

  throw new Error('writeDB is not supported in MySQL mode');
}

async function getUserByEmail(email) {
  await initDB();
  const normalizedEmail = email.toLowerCase().trim();

  if (!hasMysqlConfig()) {
    const db = await readDB();
    return db.users.find(user => user.email === normalizedEmail) || null;
  }

  const [rows] = await pool.query(
    'SELECT id, username, email, password, avatar, created_at AS createdAt FROM users WHERE email = ? LIMIT 1',
    [normalizedEmail]
  );
  return rows[0] || null;
}

async function getUserById(id) {
  await initDB();

  if (!hasMysqlConfig()) {
    const db = await readDB();
    return db.users.find(user => user.id === id) || null;
  }

  const [rows] = await pool.query(
    'SELECT id, username, email, password, avatar, created_at AS createdAt FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function createUser(user) {
  await initDB();

  if (!hasMysqlConfig()) {
    const db = await readDB();
    db.users.push(user);
    db.likes[user.id] = [];
    if (!db.likeData) db.likeData = {};
    db.likeData[user.id] = {};
    db.bookmarks[user.id] = [];
    if (!db.bookmarkData) db.bookmarkData = {};
    db.bookmarkData[user.id] = {};
    if (!db.followers) db.followers = {};
    if (!db.following) db.following = {};
    if (!db.activities) db.activities = {};
    db.followers[user.id] = [];
    db.following[user.id] = [];
    db.activities[user.id] = [];
    await writeDB(db);
    return user;
  }

  await pool.query(
    'INSERT INTO users (id, username, email, password, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [user.id, user.username, user.email, user.password, user.avatar, user.createdAt]
  );
  return user;
}

async function getLikes(userId) {
  await initDB();

  if (!hasMysqlConfig()) {
    const db = await readDB();
    return db.likes[userId] || [];
  }

  const [rows] = await pool.query(
    'SELECT image_id FROM likes WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(row => row.image_id);
}

async function toggleLike(userId, imageId, imageData = null) {
  await initDB();

  if (!hasMysqlConfig()) {
    const db = await readDB();
    if (!db.likes[userId]) db.likes[userId] = [];
    if (!db.likeData) db.likeData = {};
    if (!db.likeData[userId]) db.likeData[userId] = {};

    const idx = db.likes[userId].indexOf(imageId);
    let liked;
    if (idx === -1) {
      db.likes[userId].push(imageId);
      if (imageData) db.likeData[userId][imageId] = imageData;
      liked = true;
    } else {
      db.likes[userId].splice(idx, 1);
      delete db.likeData?.[userId]?.[imageId];
      liked = false;
    }
    await writeDB(db);
    return { liked, likes: db.likes[userId] };
  }

  const [existing] = await pool.query(
    'SELECT 1 FROM likes WHERE user_id = ? AND image_id = ? LIMIT 1',
    [userId, imageId]
  );

  let liked;
  if (existing.length) {
    await pool.query('DELETE FROM likes WHERE user_id = ? AND image_id = ?', [userId, imageId]);
    await pool.query('DELETE FROM like_data WHERE user_id = ? AND image_id = ?', [userId, imageId]);
    liked = false;
  } else {
    await pool.query('INSERT INTO likes (user_id, image_id) VALUES (?, ?)', [userId, imageId]);
    if (imageData) {
      await pool.query(
        'INSERT INTO like_data (user_id, image_id, image_data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE image_data = VALUES(image_data)',
        [userId, imageId, JSON.stringify(imageData)]
      );
    }
    liked = true;
  }

  return { liked, likes: await getLikes(userId) };
}

async function getLikedImages(userId) {
  await initDB();

  if (!hasMysqlConfig()) {
    const db = await readDB();
    const ids = db.likes[userId] || [];
    const data = db.likeData?.[userId] || {};
    const images = ids.map(id => data[id]).filter(Boolean);
    return { images, ids };
  }

  const [rows] = await pool.query(
    `SELECT l.image_id, ld.image_data
     FROM likes l
     LEFT JOIN like_data ld ON ld.user_id = l.user_id AND ld.image_id = l.image_id
     WHERE l.user_id = ?
     ORDER BY l.created_at DESC`,
    [userId]
  );

  const ids = rows.map(row => row.image_id);
  const images = rows
    .map(row => {
      if (!row.image_data) return null;
      try {
        return JSON.parse(row.image_data);
      } catch {
        return row.image_data;
      }
    })
    .filter(Boolean);

  return { images, ids };
}

async function getBookmarks(userId) {
  await initDB();

  if (!hasMysqlConfig()) {
    const db = await readDB();
    return db.bookmarks[userId] || [];
  }

  const [rows] = await pool.query(
    'SELECT image_id FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(row => row.image_id);
}

async function toggleBookmark(userId, imageId, imageData = null) {
  await initDB();

  if (!hasMysqlConfig()) {
    const db = await readDB();
    if (!db.bookmarks[userId]) db.bookmarks[userId] = [];
    if (!db.bookmarkData) db.bookmarkData = {};
    if (!db.bookmarkData[userId]) db.bookmarkData[userId] = {};

    const idx = db.bookmarks[userId].indexOf(imageId);
    let bookmarked;
    if (idx === -1) {
      db.bookmarks[userId].push(imageId);
      if (imageData) db.bookmarkData[userId][imageId] = imageData;
      bookmarked = true;
    } else {
      db.bookmarks[userId].splice(idx, 1);
      delete db.bookmarkData?.[userId]?.[imageId];
      bookmarked = false;
    }
    await writeDB(db);
    return { bookmarked, bookmarks: db.bookmarks[userId] };
  }

  const [existing] = await pool.query(
    'SELECT 1 FROM bookmarks WHERE user_id = ? AND image_id = ? LIMIT 1',
    [userId, imageId]
  );

  let bookmarked;
  if (existing.length) {
    await pool.query('DELETE FROM bookmark_data WHERE user_id = ? AND image_id = ?', [userId, imageId]);
    await pool.query('DELETE FROM bookmarks WHERE user_id = ? AND image_id = ?', [userId, imageId]);
    bookmarked = false;
  } else {
    await pool.query('INSERT INTO bookmarks (user_id, image_id) VALUES (?, ?)', [userId, imageId]);
    if (imageData) {
      await pool.query(
        'INSERT INTO bookmark_data (user_id, image_id, image_data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE image_data = VALUES(image_data)',
        [userId, imageId, JSON.stringify(imageData)]
      );
    }
    bookmarked = true;
  }

  return { bookmarked, bookmarks: await getBookmarks(userId) };
}

async function getBookmarkedImages(userId) {
  await initDB();

  if (!hasMysqlConfig()) {
    const db = await readDB();
    const ids = db.bookmarks[userId] || [];
    const data = db.bookmarkData?.[userId] || {};
    const images = ids.map(id => data[id]).filter(Boolean);
    return { images, ids };
  }

  const [rows] = await pool.query(
    `SELECT b.image_id, bd.image_data
     FROM bookmarks b
     LEFT JOIN bookmark_data bd ON bd.user_id = b.user_id AND bd.image_id = b.image_id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC`,
    [userId]
  );

  const ids = rows.map(row => row.image_id);
  const images = rows
    .map(row => {
      if (!row.image_data) return null;
      try {
        return JSON.parse(row.image_data);
      } catch {
        return row.image_data;
      }
    })
    .filter(Boolean);

  return { images, ids };
}

// Follow/unfollow
async function getFollowers(userId) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    return db.followers[userId] || [];
  }

  const [rows] = await pool.query(
    'SELECT follower_id FROM follows WHERE following_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(r => r.follower_id);
}

async function getFollowing(userId) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    return db.following[userId] || [];
  }

  const [rows] = await pool.query(
    'SELECT following_id FROM follows WHERE follower_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(r => r.following_id);
}

async function toggleFollow(actorId, targetUserId) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    if (!db.followers[targetUserId]) db.followers[targetUserId] = [];
    if (!db.following[actorId]) db.following[actorId] = [];

    const idx = db.followers[targetUserId].indexOf(actorId);
    let following;
    if (idx === -1) {
      db.followers[targetUserId].push(actorId);
      db.following[actorId].push(targetUserId);
      following = true;
    } else {
      db.followers[targetUserId].splice(idx, 1);
      const idx2 = db.following[actorId].indexOf(targetUserId);
      if (idx2 !== -1) db.following[actorId].splice(idx2, 1);
      following = false;
    }
    await writeDB(db);
    return { following, followers: db.followers[targetUserId], followingList: db.following[actorId] };
  }

  const [existing] = await pool.query(
    'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1',
    [actorId, targetUserId]
  );

  let following;
  if (existing.length) {
    await pool.query('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [actorId, targetUserId]);
    following = false;
  } else {
    await pool.query('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [actorId, targetUserId]);
    following = true;
  }

  return { following, followers: await getFollowers(targetUserId), followingList: await getFollowing(actorId) };
}

// Comments
async function addComment(userId, imageId, text) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    if (!db.comments[imageId]) db.comments[imageId] = [];
    const comment = { id: uuidv4(), userId, text, createdAt: new Date().toISOString() };
    db.comments[imageId].push(comment);
    await writeDB(db);
    return comment;
  }

  const id = uuidv4();
  const createdAt = new Date();
  await pool.query(
    'INSERT INTO comments (id, image_id, user_id, text, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, imageId, userId, text, createdAt]
  );
  return { id, userId, text, createdAt: createdAt.toISOString() };
}

async function getComments(imageId) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    return db.comments[imageId] || [];
  }

  const [rows] = await pool.query(
    'SELECT id, image_id AS imageId, user_id AS userId, text, created_at AS createdAt FROM comments WHERE image_id = ? ORDER BY created_at DESC',
    [imageId]
  );
  return rows;
}

// Activity
async function addActivity(userId, activity) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    if (!db.activities[userId]) db.activities[userId] = [];
    const a = { id: uuidv4(), ...activity, createdAt: new Date().toISOString() };
    db.activities[userId].unshift(a);
    if (db.activities[userId].length > 200) db.activities[userId].length = 200;
    await writeDB(db);
    return a;
  }

  const id = uuidv4();
  const type = activity.type || 'event';
  const payload = activity.payload ? JSON.stringify(activity.payload) : null;
  const createdAt = new Date();
  await pool.query(
    'INSERT INTO activities (id, user_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, userId, type, payload, createdAt]
  );
  return { id, type, payload: activity.payload || null, createdAt: createdAt.toISOString() };
}

async function getActivities(userId, limit = 50) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    const acts = db.activities[userId] || [];
    return acts.slice(0, limit);
  }

  const [rows] = await pool.query(
    'SELECT id, user_id AS userId, type, payload, created_at AS createdAt FROM activities WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, Number(limit)]
  );
  return rows.map(r => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : null }));
}

// Images (user uploads)
async function createImage(image) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    const img = { id: image.id || uuidv4(), ...image, createdAt: new Date().toISOString() };
    db.images.unshift(img);
    await writeDB(db);
    return img;
  }

  const id = image.id || uuidv4();
  const createdAt = new Date();
  await pool.query(
    `INSERT INTO images (id, owner_id, url, thumb, full, width, height, description, likes, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      image.ownerId,
      image.url,
      image.thumb || null,
      image.full || null,
      image.width || null,
      image.height || null,
      image.description || null,
      image.likes || 0,
      JSON.stringify(image.tags || []),
      createdAt,
    ]
  );

  return { id, ownerId: image.ownerId, url: image.url, thumb: image.thumb, full: image.full, description: image.description, tags: image.tags || [], createdAt: createdAt.toISOString() };
}

async function getImageById(imageId) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    return db.images.find(i => i.id === imageId) || null;
  }

  const [rows] = await pool.query('SELECT * FROM images WHERE id = ? LIMIT 1', [imageId]);
  if (!rows[0]) return null;
  const r = rows[0];
  let tags = [];
  try { tags = r.tags ? JSON.parse(r.tags) : []; } catch { tags = [] }
  return { id: r.id, ownerId: r.owner_id, url: r.url, thumb: r.thumb, full: r.full, width: r.width, height: r.height, description: r.description, likes: r.likes, tags, createdAt: r.created_at };
}

async function listImages({ page = 1, perPage = 30, q = '', tags = [], excludeIds = [] } = {}) {
  await initDB();
  const offset = (page - 1) * perPage;

  if (!hasMysqlConfig()) {
    const db = await readDB();
    let imgs = db.images || [];
    if (excludeIds && excludeIds.length) imgs = imgs.filter(i => !excludeIds.includes(i.id));
    if (q) {
      const ql = q.toLowerCase();
      imgs = imgs.filter(i => (i.description && i.description.toLowerCase().includes(ql)) || (Array.isArray(i.tags) && i.tags.join(' ').toLowerCase().includes(ql)));
    }
    if (tags && tags.length) {
      imgs = imgs.filter(i => (i.tags || []).some(t => tags.includes(t)));
    }
    // newest first
    imgs = imgs.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
    return imgs.slice(offset, offset + perPage);
  }

  // Build SQL
  const where = [];
  const params = [];
  if (excludeIds && excludeIds.length) {
    where.push(`id NOT IN (${excludeIds.map(() => '?').join(',')})`);
    params.push(...excludeIds);
  }
  if (q) {
    where.push('(description LIKE ? OR tags LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (tags && tags.length) {
    const tagConds = tags.map(() => `tags LIKE ?`).join(' OR ');
    where.push(`(${tagConds})`);
    for (const t of tags) params.push(`%${t}%`);
  }

  const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT id, owner_id AS ownerId, url, thumb, full, width, height, description, likes, tags, created_at AS createdAt FROM images ${whereSQL} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(perPage), Number(offset));
  const [rows] = await pool.query(sql, params);
  return rows.map(r => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] }));
}

async function addReport(report) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    db.reports = db.reports || [];
    const r = { id: uuidv4(), ...report, createdAt: new Date().toISOString() };
    db.reports.unshift(r);
    await writeDB(db);
    return r;
  }

  const id = uuidv4();
  const createdAt = new Date();
  await pool.query(
    'INSERT INTO reports (id, reporter_id, target_type, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, report.reporterId, report.targetType, report.targetId, report.reason || null, createdAt]
  );
  return { id, reporterId: report.reporterId, targetType: report.targetType, targetId: report.targetId, reason: report.reason || null, createdAt: createdAt.toISOString() };
}

async function getReports() {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    return db.reports || [];
  }
  const [rows] = await pool.query('SELECT id, reporter_id AS reporterId, target_type AS targetType, target_id AS targetId, reason, created_at AS createdAt FROM reports ORDER BY created_at DESC');
  return rows.map(r => ({ ...r }));
}

async function deleteImage(imageId) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    db.images = db.images.filter(i => i.id !== imageId);
    // remove from bookmarks/likes/comments
    for (const uid of Object.keys(db.likes || {})) {
      db.likes[uid] = (db.likes[uid] || []).filter(id => id !== imageId);
    }
    for (const uid of Object.keys(db.bookmarks || {})) {
      db.bookmarks[uid] = (db.bookmarks[uid] || []).filter(id => id !== imageId);
      if (db.bookmarkData?.[uid]) delete db.bookmarkData[uid][imageId];
    }
    if (db.comments && db.comments[imageId]) delete db.comments[imageId];
    await writeDB(db);
    return true;
  }

  const [res] = await pool.query('DELETE FROM images WHERE id = ?', [imageId]);
  await pool.query('DELETE FROM likes WHERE image_id = ?', [imageId]);
  await pool.query('DELETE FROM bookmarks WHERE image_id = ?', [imageId]);
  await pool.query('DELETE FROM bookmark_data WHERE image_id = ?', [imageId]);
  await pool.query('DELETE FROM comments WHERE image_id = ?', [imageId]);
  await pool.query('DELETE FROM reports WHERE target_type = ? AND target_id = ?', ['image', imageId]);
  return res.affectedRows > 0;
}

async function banUser(userId) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return false;
    user.banned = true;
    // remove user's images
    db.images = db.images.filter(i => i.ownerId !== userId);
    // clear sessions not handled here
    await writeDB(db);
    return true;
  }

  const [res] = await pool.query('UPDATE users SET banned = 1 WHERE id = ?', [userId]);
  if (res.affectedRows === 0) return false;
  await pool.query('DELETE FROM images WHERE owner_id = ?', [userId]);
  // optionally remove other user data
  return true;
}

async function updateUserAvatar(userId, avatarUrl) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return false;
    user.avatar = avatarUrl;
    await writeDB(db);
    return true;
  }

  const [res] = await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, userId]);
  return res.affectedRows > 0;
}

// Admin actions: reports, delete image, ban user
async function addReport(report) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    db.reports = db.reports || [];
    const r = { id: uuidv4(), ...report, createdAt: new Date().toISOString() };
    db.reports.unshift(r);
    await writeDB(db);
    return r;
  }
  throw new Error('addReport not implemented in MySQL mode');
}

async function getReports() {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    return db.reports || [];
  }
  throw new Error('getReports not implemented in MySQL mode');
}

async function deleteImage(imageId) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    db.images = db.images.filter(i => i.id !== imageId);
    // remove from bookmarks/likes/comments
    for (const uid of Object.keys(db.likes || {})) {
      db.likes[uid] = (db.likes[uid] || []).filter(id => id !== imageId);
    }
    for (const uid of Object.keys(db.bookmarks || {})) {
      db.bookmarks[uid] = (db.bookmarks[uid] || []).filter(id => id !== imageId);
      if (db.bookmarkData?.[uid]) delete db.bookmarkData[uid][imageId];
    }
    if (db.comments && db.comments[imageId]) delete db.comments[imageId];
    await writeDB(db);
    return true;
  }
  throw new Error('deleteImage not implemented in MySQL mode');
}

async function banUser(userId) {
  await initDB();
  if (!hasMysqlConfig()) {
    const db = await readDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return false;
    user.banned = true;
    // remove user's images
    db.images = db.images.filter(i => i.ownerId !== userId);
    // clear sessions not handled here
    await writeDB(db);
    return true;
  }
  throw new Error('banUser not implemented in MySQL mode');
}

module.exports = {
  initDB,
  readDB,
  writeDB,
  getUserByEmail,
  getUserById,
  createUser,
  getLikes,
  toggleLike,
  getLikedImages,
  getBookmarks,
  toggleBookmark,
  getBookmarkedImages,
  getFollowers,
  getFollowing,
  toggleFollow,
  addComment,
  getComments,
  addActivity,
  getActivities,
  createImage,
  getImageById,
  addReport,
  getReports,
  deleteImage,
  banUser,
  listImages,
  updateUserAvatar,
};
