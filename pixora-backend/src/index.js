require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const imagesRoutes = require('./routes/images');
const userRoutes = require('./routes/user');
const supportRoutes = require('./routes/support');
const { initDB } = require('./utils/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      return cb(null, true);
    }
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/user', userRoutes);
app.use('/api/support', supportRoutes);

app.get("/", (req, res) => {
    res.send("Pixora backend running successfully");
});
// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Pixora API is running', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

initDB()
  .then(() => {
    app.listen(PORT, () => {
      const unsplash = process.env.UNSPLASH_ACCESS_KEY && process.env.UNSPLASH_ACCESS_KEY !== 'your_unsplash_access_key_here';
      const pexels   = process.env.PEXELS_API_KEY   && process.env.PEXELS_API_KEY   !== 'your_pexels_api_key_here';
      const pixabay  = process.env.PIXABAY_API_KEY  && process.env.PIXABAY_API_KEY  !== 'your_pixabay_api_key_here';
      const postgresEnabled = process.env.DATABASE_URL;
      console.log(`\n🖤 Pixora API running on http://localhost:${PORT}`);
      console.log(`💾 Database : ${postgresEnabled ? '✅ PostgreSQL (Neon)' : '⚠️ JSON file fallback'}`);
      console.log(`📸 Active sources:`);
      console.log(`   Unsplash : ${unsplash ? '✅ (50 req/hr, 10 req/s)' : '❌ no key'}`);
      console.log(`   Pexels   : ${pexels   ? '✅ (200 req/hr)' : '❌ no key'}`);
      console.log(`   Pixabay  : ${pixabay  ? '✅ (100 req/min, 100k+ images)' : '❌ no key – add PIXABAY_API_KEY'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app;
