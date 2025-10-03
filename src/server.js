const Absence = require('../models/Absence');
// --- Import Routes ---
// Ensure paths are correct relative to this file's location
// absenceRoutes will be imported after app initialization
// ...existing code...
// --- API Route Middleware ---
// These will be registered after DB connection and app initialization
const express = require("express");
const bodyParser = require("body-parser"); // You might not strictly need this if only using express.json/urlencoded
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const path = require('path'); // <--- IMPORT path MODULE
const fs = require('fs'); // Add fs module for directory checking
const connectToDatabase = require("./db"); // Assuming db.js is in the same directory
const axios = require("axios");
const cron = require('node-cron');
const Timetable = require('../models/Timetable');
const Announcement = require('../models/Announcement');
const http = require('http');
const { initSocket } = require("./socket");

// Load environment variables from .env file
dotenv.config();

// Initialize Express app
const app = express();
// --- Global Middleware ---
app.use(helmet());

// CORS Configuration - Environment-driven solution
if (!process.env.ALLOWED_ORIGINS) {
  throw new Error('ALLOWED_ORIGINS environment variable is required. Set it to a comma-separated list of allowed origins.');
}

const allowedOrigins = process.env.ALLOWED_ORIGINS
  .split(',')
  .map(origin => origin.trim())
  .filter(origin => origin.length > 0);

if (process.env.NODE_ENV !== 'production') {
  console.log('CORS Allowed Origins:', allowedOrigins);
}

// Robust CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // In development, allow all localhost origins
    if (process.env.NODE_ENV !== 'production' && origin.includes('localhost')) {
      return callback(null, true);
    }

    // Check against allowed origins
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-CSRF-Token'
  ],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Global limiter (less strict, or remove entirely if you want per-route only)
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 400 });
// app.use(globalLimiter); // Uncomment if you want a global fallback

// Stricter limiter for frequently-called endpoints (e.g., dashboard polling)
// Allow the limit to be controlled via DASHBOARD_RATE_LIMIT env var. In development
// default to a much higher limit to avoid accidental 429s while working locally.
const dashboardWindowMs = 15 * 60 * 1000; // 15 minutes
let dashboardMax = 60; // default for production
if (process.env.DASHBOARD_RATE_LIMIT) {
  const parsed = parseInt(process.env.DASHBOARD_RATE_LIMIT, 10);
  if (!isNaN(parsed) && parsed > 0) dashboardMax = parsed;
} else if (process.env.NODE_ENV !== 'production') {
  // Relax limits for local development to avoid blocking rapid reloads
  dashboardMax = 1000;
}

const dashboardLimiter = rateLimit({
  windowMs: dashboardWindowMs,
  max: dashboardMax,
  message: 'Too many dashboard requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

if (process.env.NODE_ENV !== 'production') {
  console.log(`Dashboard rate limiter configured: max=${dashboardMax} per ${dashboardWindowMs}ms`);
}
// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// --- Database Connection and Route Setup ---
connectToDatabase()
  .then(() => {
    // --- Import Routes ---
    const authRoutes = require("../routes/authRoutes");
    const enrollmentRoutes = require("../routes/enrollmentRoutes");
    const classRoutes = require("../routes/classRoutes");
    const dashboardRoutes = require("../routes/dashboardRoutes");
    const bookingRoutes = require('../routes/bookingRoutes');
    const adminRoutes = require("../routes/adminRoutes");
    const HssmRoutes = require("../routes/HssmRoutes");
    const chatRoutes = require('../routes/chatRoutes');
    const twofaRoutes = require('../routes/twofaRoutes');
    const googleAuthRoutes = require('../routes/googleAuthRoutes');
    const absenceRoutes = require('../routes/absenceRoutes');
    const notificationRoutes = require('../routes/notificationRoutes');
    const studentRoutes = require('../routes/studentRoutes');
    const teacherRoutes = require('../routes/teacherRoutes');
    const hodRoutes = require('../routes/hodRoutes');
    const creditRoutes = require('../routes/creditRoutes');
    const hssmProviderRoutes = require('../routes/hssmProviderRoutes');
    const reportRoutes = require('../routes/reportRoutes');
    const announcementRoutes = require('../routes/announcementRoutes');
    const aiRoutes = require('../routes/aiRoutes');
    const hssmDashboardRoutes = require('../routes/hssmDashboardRoutes');
    const timetableRoutes = require('../routes/timetableRoutes');
    const venueRoutes = require('../routes/venueRoutes');
    const serviceRoutes = require('../routes/serviceRoutes');

    // CORS test endpoint
    app.get('/api/test-cors', (req, res) => {
      res.json({
        message: 'CORS is working!',
        origin: req.headers.origin,
        node_env: process.env.NODE_ENV,
        allowed_origins: allowedOrigins,
        timestamp: new Date().toISOString()
      });
    });

    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.json({
        status: 'OK',
        message: 'Server is running',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        cors_enabled: true
      });
    });

const notificationRoutes = require('../routes/notificationRoutes');
const reportRoutes = require('../routes/reportRoutes');
const requestRoutes = require('../routes/requestRoutes');
const serviceRoutes = require('../routes/serviceRoutes');
const studentRoutes = require('../routes/studentRoutes');
const teacherRoutes = require('../routes/teacherRoutes');
const timetableRoutes = require('../routes/timetableRoutes');
const twofaRoutes = require('../routes/twofaRoutes');
const venueRoutes = require('../routes/venueRoutes');

// ... (other route imports)

// --- API Routes ---
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/hssm', HssmRoutes);
app.use('/api/hssm-dashboard', hssmDashboardRoutes);
app.use('/api/hssm-providers', hssmProviderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/timetables', timetableRoutes);
app.use('/api/2fa', twofaRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/auth/google', googleAuthRoutes);    // Serve uploaded files statically
    app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

    // --- Default Route ---
    app.get("/", (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.send("<h1>Welcome to the Local Service App API</h1><p>API endpoints are available under /api/...</p>");
    });

    // --- Catch-all for undefined routes (404 Not Found) ---
    app.use((req, res, next) => {
      res.status(404).json({ success: false, message: `Cannot ${req.method} ${req.originalUrl}` });
    });

    // --- Central Error Handling Middleware ---
    app.use((err, req, res, next) => {
      if (err.message === "Not allowed by CORS") {
        return res.status(403).json({
          success: false,
          message: "Origin not allowed by CORS policy."
        });
      }
      const statusCode = err.status || err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
      });
    });

    // --- Scheduled Jobs ---
    // Automated class reminders
    cron.schedule('*/5 * * * *', async () => {
      try {
        const now = new Date();
        const reminderWindow = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

        // Find classes starting in the next 30 mins that haven't had a reminder sent
        const upcomingClasses = await Timetable.find({
          startTime: { $gte: now, $lte: reminderWindow },
          reminderSent: { $ne: true }
        }).populate('teacher');

        for (const cls of upcomingClasses) {
          // Create a targeted announcement for the department
          await Announcement.create({
            title: `Class Reminder: ${cls.subject}`,
            content: `Your class for "${cls.subject}" is starting at ${cls.startTime} in ${cls.venue}. Teacher: ${cls.teacher?.name || 'TBA'}`,
            department: cls.department,
            createdBy: 'System',
          });

          // Mark the class so we don't send another reminder
          cls.reminderSent = true;
          await cls.save();
        }
      } catch (error) {
        console.error('Error in class reminder scheduler:', error);
      }
    });

    // Delete expired absences daily at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        const now = new Date();
        // Absence expires after dateOfAbsence + duration (in days)
        // So, delete if now > dateOfAbsence + duration days
        const expired = await Absence.deleteMany({
          $expr: {
            $lt: [
              { $add: ["$dateOfAbsence", { $multiply: ["$duration", 24 * 60 * 60 * 1000] }] },
              now
            ]
          }
        });
        if (expired.deletedCount > 0) {
          console.log(`Deleted ${expired.deletedCount} expired absences at ${now.toISOString()}`);
        }
      } catch (error) {
        console.error('Error deleting expired absences:', error);
      }
    });

    // Archive past timetable entries daily at 3:00 AM
    cron.schedule('0 3 * * *', async () => {
      try {
        const now = new Date();
        const result = await Timetable.updateMany({ endDate: { $lt: now }, archived: { $ne: true } }, { $set: { archived: true } });
        if (result.modifiedCount > 0) {
          console.log(`Archived ${result.modifiedCount} past timetable entries at ${now.toISOString()}`);
        }
      } catch (err) {
        console.error('Error archiving past timetable entries:', err);
      }
    });

    // --- Socket.io Configuration ---
    const server = http.createServer(app);
    const io = initSocket(server, allowedOrigins);

    // --- Start the Server ---
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });
