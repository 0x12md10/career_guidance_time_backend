import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import registrationRoutes from './routes/registration.js';
import adminRoutes from './routes/admin.js';
import checkinRoutes from './routes/checkin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in environment variables');
  process.exit(1);
}
// checkpoint1
// ─── Security headers ────────────────────────────────────────────────────────

app.set('trust proxy', 1); // Add this line
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  FRONTEND_URL,
  'https://sigaramthodu.timetirunelveli.com',
  'https://sigaramattendance.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5174',
].filter(Boolean);

app.use(
  cors({
    // origin : 'https://sigaramthodu.timetirunelveli.com',
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// ─── Global rate limiter ──────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,                  // max 100 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again later.' },
  })
);

// ─── Request ID middleware ────────────────────────────────────────────────────
app.use((req, _res, next) => {
  req.id = Math.random().toString(36).slice(2, 10);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/register', registrationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/checkin', checkinRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sigaram-backend',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  // Never leak stack traces to the client in production
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;
  console.error(`[${req.id}] Error ${status}: ${err.message}`);
  res.status(status).json({ success: false, message });
});

// ─── MongoDB + server bootstrap ───────────────────────────────────────────────
mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  })
  .then(() => {
    console.log('✅ MongoDB connected');
    const server = app.listen(PORT, () => {
      console.log(`🚀 Sigaram backend running on port ${PORT}`);
    });

    // ─── Graceful shutdown ──────────────────────────────────────────────────
    const shutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully…`);
      server.close(() => {
        mongoose.connection.close(false).then(() => {
          console.log('✅ MongoDB disconnected. Exiting.');
          process.exit(0);
        });
      });
      // Force-kill after 10s if something hangs
      setTimeout(() => process.exit(1), 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
