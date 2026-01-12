import express from 'express';
import connectDB from './config/db';
import dotenv from 'dotenv'
import authRoutes from './routes/auth.routes.js';

const app = express();

//Contect mongodb
connectDB();

app.use(express.json());
app.use('/api/auth', authRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
