require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const imagesRoutes = require('./routes/images');
const userRoutes = require('./routes/user');
const supportRoutes = require('./routes/support');
const { initDB } = require('./utils/db');
const { globalErrorHandler } = require('./middleware/errorHandler');
const { ValidationError } = require('./utils/errorHandler');
const { getAllRateLimitStates } = require('./middleware/rateLimitTracker');

const app = express();
const PORT = process.env.PORT || 5000;

// ════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════

// CORS with whitelist
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      return cb(null, true);
    }
    if (origin === 'https://pixorafrontend.z29.web.core.windows.net' || origin === process.env.FRONTEND_URL) {
      return cb(null, true);
    }
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Handle JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return next(new ValidationError('Invalid JSON'));
  }
  next();
});

// Global rate limiting: 200 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
});
app.use('/api/', apiLimiter);

// ════════════════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════════════════

app.use('/api/auth', authRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/user', userRoutes);
app.use('/api/support', supportRoutes);

app.get('/', (req, res) => {
  res.send('Pixora backend running successfully');
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Pixora API is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health/diagnostics', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    },
    rateLimits: getAllRateLimitStates(),
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    status: 404,
  });
});

// ✅ Global error handler MUST be last
app.use(globalErrorHandler);

// ════════════════════════════════════════════════════════════════════════════
// SERVER STARTUP & SHUTDOWN
// ════════════════════════════════════════════════════════════════════════════

async function startServer() {
  try {
    await initDB();

    const server = app.listen(PORT, () => {
      const unsplash = process.env.UNSPLASH_ACCESS_KEY && process.env.UNSPLASH_ACCESS_KEY !== 'your_unsplash_access_key_here';
      const pexels = process.env.PEXELS_API_KEY && process.env.PEXELS_API_KEY !== 'your_pexels_api_key_here';
      const pixabay = process.env.PIXABAY_API_KEY && process.env.PIXABAY_API_KEY !== 'your_pixabay_api_key_here';
      const postgresEnabled = process.env.DATABASE_URL;

      console.log(`\n🖤 Pixora API running on http://localhost:${PORT}`);
      console.log(`💾 Database : ${postgresEnabled ? '✅ PostgreSQL' : '⚠️ JSON fallback'}`);
      console.log(`📸 API Sources:`);
      console.log(`   Unsplash : ${unsplash ? '✅' : '❌'}`);
      console.log(`   Pexels   : ${pexels ? '✅' : '❌'}`);
      console.log(`   Pixabay  : ${pixabay ? '✅' : '❌'}`);
      console.log(`🔗 Health: http://localhost:${PORT}/api/health\n`);
    });

    // Graceful shutdown on SIGTERM (Azure sends this)
    async function gracefulShutdown(signal) {
      console.log(`\n\n🛑 ${signal} received - graceful shutdown initiated...`);

      server.close(async () => {
        console.log('✅ HTTP server closed');

        try {
          const db = require('./utils/db');
          if (db.pool) {
            await db.pool.end();
            console.log('✅ Database connections closed');
          }
        } catch (err) {
          console.error('Error closing database:', err);
        }

        console.log('👋 Goodbye!\n');
        process.exit(0);
      });

      setTimeout(() => {
        console.error('❌ Forced shutdown after 30s');
        process.exit(1);
      }, 30000);
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
