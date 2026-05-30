/**
 * Global error handler middleware
 * Must be placed after all other middleware/routes
 */

const { AppError } = require('../utils/errorHandler');

function globalErrorHandler(err, req, res, next) {
  err.statusCode = err.statusCode || 500;

  // Log all errors
  const logLevel = err.statusCode >= 500 ? 'error' : 'warn';
  console[logLevel](
    `[${req.method}] ${req.path} - ${err.statusCode} ${err.message}`,
    {
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }
  );

  // Known operational error
  if (err.isOperational) {
    const response = {
      error: err.message,
      status: err.statusCode,
    };

    // Include retryAfter for rate limit errors
    if (err.retryAfter) {
      response.retryAfter = err.retryAfter;
      res.setHeader('Retry-After', err.retryAfter);
    }

    return res.status(err.statusCode).json(response);
  }

  // Programming or unknown error
  console.error('❌ Unhandled error (programming bug):', err);
  return res.status(500).json({
    error: 'Internal server error',
    status: 500,
    // Don't expose stack trace in production
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // In production, process should exit and be restarted by PM2/Docker
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

module.exports = { globalErrorHandler };
