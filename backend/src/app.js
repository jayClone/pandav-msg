import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import logger from './config/logger.js';
import apiRoutes from './routes/index.js';
import { globalArcjet } from './middlewares/arcjet.js'; 
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ============================================
//  TRUST PROXY (RENDER PASSES REAL IP HERE)
// ============================================
app.set('trust proxy', 1);

// ============================================
//  ENSURE LOGS DIRECTORY EXISTS
// ============================================
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ============================================
// CRITICAL: BODY PARSER MUST BE FIRST
// ============================================

//  1. Body parser BEFORE any other middleware
app.use(express.json({ limit: '50mb' }));  
app.use(express.urlencoded({ limit: '50mb', extended: true }));

//  ADD COMPRESSION MIDDLEWARE (AFTER body parser, BEFORE routes)
app.use(compression({
  level: 6, 
  threshold: 10 * 1024,  
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// ============================================
// RATE LIMITING (GLOBAL - AFTER COMPRESSION)
// ============================================
app.use(globalArcjet);

// 2. THEN security headers
app.use(helmet());

// 3. THEN CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  'https://pandav-msg.vercel.app',  
  'https://pandav-msg-frontend.vercel.app'
].filter(Boolean); 

console.log('🔐 [CORS] Allowed origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3001',
      'https://pandav-msg-frontend.vercel.app',
      'https://pandav-msg.vercel.app',
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

// ============================================
// DEBUG MIDDLEWARE - Only in development
// ============================================

if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    if (req.path.includes('/auth/register') || req.path.includes('/otp')) {
      console.log(`\n🔍 [DETAILED-LOG] ${req.method} ${req.path}`);
      console.log('━'.repeat(50));
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Raw Body:', req.body);
      console.log('Body Keys:', Object.keys(req.body));
      console.log('━'.repeat(50) + '\n');
    }
    next();
  });

  app.use((req, res, next) => {
    console.log(`📨 [${req.method}] ${req.path}`);
    next();
  });
} else {
  app.use((req, res, next) => {
    if (req.path.includes('/auth') || req.path.includes('/error')) {
      console.log(`📨 [${req.method}] ${req.path}`);
    }
    next();
  });
}

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