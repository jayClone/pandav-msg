import express from 'express';
import cors from 'cors';
import apiRoutes from '@routes/index.js';

const app = express();

// Middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// CORS Configuration
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));

// ✅ API Routes - CRITICAL: Must be /api
app.use('/api', apiRoutes);

// Health check root endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        version: 'v1'
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        availableRoutes: [
            'GET /health',
            'POST /api/v1/auth/register',
            'POST /api/v1/auth/login',
            'GET /api/v1/auth/current'
        ]
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        version: 'v1'
    });
});

export default app;
