import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
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
// CRITICAL: BODY PARSER MUST BE FIRST
// ============================================

// ✅ 1. Body parser BEFORE any other middleware
app.use(express.json({ limit: '50mb' }));  // ✅ INCREASED LIMIT
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. THEN security headers
app.use(helmet());

// 3. THEN CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ============================================
// DEBUG MIDDLEWARE - Log all requests (DETAILED)
// ============================================

app.use((req, res, next) => {
  // ✅ DETAILED LOGGING
  if (req.path.includes('/auth/register') || req.path.includes('/otp')) {
    console.log(`\n🔍 [DETAILED-LOG] ${req.method} ${req.path}`);
    console.log('━'.repeat(50));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Raw Body:', req.body);
    console.log('Body Keys:', Object.keys(req.body));
    console.log('Body.otp:', req.body.otp, 'Type:', typeof req.body.otp);
    console.log('━'.repeat(50) + '\n');
  }
  next();
});

// ============================================
// DEBUG MIDDLEWARE - Log all requests
// ============================================

app.use((req, res, next) => {
  console.log(`📨 [${req.method}] ${req.path}`);
  console.log('📦 req.body:', JSON.stringify(req.body, null, 2));
  console.log('📦 Content-Type:', req.headers['content-type']);
  next();
});

// ============================================
// HEALTH CHECK
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
// API ROUTES
// ============================================

app.use('/api', apiRoutes);

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// ============================================
// GLOBAL ERROR HANDLER (MUST BE LAST)
// ============================================

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';

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

  const message = isDev ? err.message : 'Internal Server Error';
  const stack = isDev ? err.stack : undefined;

  res.status(statusCode).json({
    success: false,
    message,
    ...(isDev && { stack })
  });
});

export default app;