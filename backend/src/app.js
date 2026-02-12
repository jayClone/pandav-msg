import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import logger from './config/logger.js';
import apiRoutes from './routes/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ============================================
// ✅ ENSURE LOGS DIRECTORY EXISTS
// ============================================
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ============================================
// SECURITY MIDDLEWARE (Order matters!)
// ============================================

// 1. Helmet - Security headers (FIRST)
app.use(helmet());

// 2. Body parser with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// 3. CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ============================================
// RATE LIMITING
// ============================================

// ✅  Bypass rate limiting in test environment
const isTestEnv = process.env.NODE_ENV === 'test';

// General rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 10000 : 100, // ✅ Unlimited in test mode
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isTestEnv, // ✅ Skip rate limiting in tests
});

// Auth-specific rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 10000 : 50, // ✅ Unlimited in test mode
  message: 'Too many login/register attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isTestEnv, // ✅ Skip rate limiting in tests
});

app.use('/api/', limiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/', limiter);

// ============================================
//  HEALTH CHECK (BEFORE ALL OTHER ROUTES)
// ============================================

app.get('/health', (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || 'v1',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(200).json({ success: true, status: 'ok' });
  }
});

// ============================================
//  API ROUTES
// ============================================

app.use('/api', apiRoutes);

// ============================================
// ❌ 404 HANDLER
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// ============================================
//  GLOBAL ERROR HANDLER (MUST BE LAST)
// ============================================

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';

  // Log error
  try {
    logger.error({
      message: err.message,
      statusCode,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
  } catch (logErr) {
    console.error('Logging error:', logErr.message);
  }

  // Don't expose error details in production
  const message = isDev ? err.message : 'Internal Server Error';
  const stack = isDev ? err.stack : undefined;

  res.status(statusCode).json({
    success: false,
    message,
    ...(isDev && { stack })
  });
});

export default app;