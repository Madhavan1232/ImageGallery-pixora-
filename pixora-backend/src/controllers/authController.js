const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const {
  getUserByEmail,
  getUserById,
  createUser,
} = require('../utils/db');

async function signup(req, res) {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = {
      id: uuidv4(),
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'user',
      createdAt: new Date().toISOString(),
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}&backgroundColor=000000&textColor=ffffff`
    };

    await createUser(newUser);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, username: newUser.username, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      token,
      user: { id: newUser.id, username: newUser.username, email: newUser.email, avatar: newUser.avatar, role: newUser.role }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, role: user.role || 'user' }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMe(req, res) {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, username: user.username, email: user.email, avatar: user.avatar });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Handle Google sign-in: create or return existing user
async function googleSignIn(req, res) {
  try {
    const { email, name, avatar } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = String(email).toLowerCase().trim();
    let user = await getUserByEmail(normalizedEmail);
    if (user) {
      const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      return res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar } });
    }

    // Create a safe username from name or email
    let baseUsername = name ? String(name).replace(/\s+/g, '').toLowerCase() : normalizedEmail.split('@')[0];
    if (!baseUsername) baseUsername = `user${Date.now()}`;
    const username = baseUsername;

    // Generate a random password so the DB's non-null constraint is satisfied
    const randomPassword = uuidv4();
    const hashedPassword = await bcrypt.hash(randomPassword, 12);

    const newUser = {
      id: uuidv4(),
      username,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user',
      createdAt: new Date().toISOString(),
      avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}&backgroundColor=000000&textColor=ffffff`
    };

    await createUser(newUser);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, username: newUser.username, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({ token, user: { id: newUser.id, username: newUser.username, email: newUser.email, avatar: newUser.avatar } });
  } catch (err) {
    console.error('Google sign-in error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { signup, login, getMe, googleSignIn };

