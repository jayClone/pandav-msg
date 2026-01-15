import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import healthRoutes from './routes/health.routes.js';

const app = express();

//Contect mongodb
connectDB();

// Dynamic CORS Configuration
const getCorsOptions = () => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isTest = process.env.NODE_ENV === 'test';

    if (isTest) {
        return {
            origin: '*',
            credentials: false,
        };
    }

    return {
        origin: isDevelopment 
            ? ['http://localhost:3000', 'http://localhost:5173']
            : process.env.CLIENT_URL,
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 86400, // 24 hours
    };
};

app.use(cors(getCorsOptions()));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
