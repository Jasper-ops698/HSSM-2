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

// Load environment variables from .env file
dotenv.config();

// Initialize Express app
const app = express();

// --- Core Middleware ---

// Security Headers (with adjustments for images)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Response Compression
app.use(compression());

// Request Logging (Using 'common' format, suitable for production)
// Consider 'dev' for development: app.use(morgan('dev'));
app.use(morgan("common"));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { success: false, message: "Too many requests, please try again later." },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => req.path.startsWith('/uploads'), // Skip rate limiting for uploads
});
app.use(limiter);

app.use(express.json({ limit: "10kb" }));

// --- CORS Configuration ---
const defaultOrigin = "https://hssm-sevices-page.onrender.com";
let allowedOrigins = [defaultOrigin, "http://localhost:3000", "http://localhost:4000"];

if (process.env.ALLOWED_ORIGINS) {
  const additionalOrigins = process.env.ALLOWED_ORIGINS.split(",").map(origin => origin.trim());
  allowedOrigins = [...allowedOrigins, ...additionalOrigins];
}
console.log("Allowed CORS Origins:", allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`CORS Error: Origin '${origin}' not allowed:`, origin);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Origin", "Accept"],
  credentials: true,
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Explicitly handle preflight (OPTIONS) requests
// This ensures OPTIONS requests get the correct CORS headers before the actual request
app.options("*", cors(corsOptions));

// Allow CORS preflight for DELETE on reports endpoints
app.options('/api/admin/hssmProviderReports/:id', cors(corsOptions));
// If you have other report delete endpoints, add them here as well

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

// Configure static file serving with CORS headers
app.use('/uploads', (req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    'Cross-Origin-Resource-Policy': 'cross-origin'
  });
  next();
}, express.static(path.join(__dirname, '../uploads')));

console.log(`Serving static files from: ${uploadsDir}`);

// --- Database Connection and Route Setup ---
connectToDatabase()
  .then(() => {
    console.log("Successfully connected to the database.");

    // --- Import Routes ---
    // Ensure paths are correct relative to this file's location
    const serviceRoutes = require("../routes/serviceRoutes");
    const authRoutes = require("../routes/authRoutes");
    const requestRoutes = require("../routes/requestRoutes");
    const dashboardRoutes = require("../routes/dashboardRoutes");
    const adminRoutes = require("../routes/adminRoutes");
    const HssmRoutes = require("../routes/HssmRoutes");
    const chatRoutes = require('../routes/chatRoutes');
    const twofaRoutes = require('../routes/twofaRoutes');

    // --- API Route Middleware ---
    app.use("/api/auth", authRoutes);
    app.use("/api/services", serviceRoutes);
    app.use("/api/requests", requestRoutes);
    app.use("/api/dashboard", dashboardRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/hssm", HssmRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/2fa', twofaRoutes);

    // --- Gemini AI Routes ---
    // (Keeping the Gemini routes as you provided them)
    app.post("/api/gemini/report", async (req, res, next) => { // Added next for error handling consistency
      try {
        const { userId, startDate, endDate } = req.body;

        if (!userId || !startDate || !endDate) {
          return res.status(400).json({
            success: false,
            message: "Missing required fields: userId, startDate, or endDate",
          });
        }

        // Fetch real data using Mongoose models
        const { Incident, Asset, Task, MeterReading, HospitalProfile } = require('../models/Hssm');
        const profile = await HospitalProfile.findOne({ userId });
        const incidents = await Incident.find({ userId, date: { $gte: new Date(startDate), $lte: new Date(endDate) } });
        const assets = await Asset.find({ userId });
        const tasks = await Task.find({ userId, dueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } });
        const meterReadings = await MeterReading.find({ userId, date: { $gte: new Date(startDate), $lte: new Date(endDate) } });

        // Prepare data for the AI API
        const inputData = {
          contents: [ { parts: [ {
                text: `Generate a comprehensive technical and management report for a hospital with the following profile and operational data.\n\nMission: ${profile?.mission || 'Not set'}\nVision: ${profile?.vision || 'Not set'}\nService Charter: ${profile?.serviceCharter || 'Not set'}\n\nAssets: ${assets.length}\nIncidents: ${incidents.length}\nTasks: ${tasks.length}\nMeter Readings: ${meterReadings.length}\n\nDetailed Data (for context):\nIncidents: ${JSON.stringify(incidents)}\nAssets: ${JSON.stringify(assets)}\nTasks: ${JSON.stringify(tasks)}\nMeter Readings: ${JSON.stringify(meterReadings)}\n\nBased on this, provide:\n- Actionable recommendations for improvement\n- A prediction of the facility's future growth and challenges\n- A summary for management and stakeholders.`
              } ] } ],
        };

        // Call the Gemini AI API (ensure GEMINI_API_KEY is set in .env)
        const aiResponse = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, // Corrected endpoint structure
          inputData,
          { headers: { "Content-Type": "application/json" } } // API key is in URL now
        );

        // Check for response structure and potential errors from Gemini API
        if (aiResponse.data && aiResponse.data.candidates && aiResponse.data.candidates[0].content) {
          res.status(200).json({
            success: true,
            report: aiResponse.data.candidates[0].content.parts[0].text,
          });
        } else {
          console.error("Unexpected AI API response structure:", aiResponse.data);
          // Send back Gemini's error if available
          const errorMessage = aiResponse.data?.error?.message || "Failed to generate report: Unexpected AI response.";
          res.status(500).json({ success: false, message: errorMessage });
        }
      } catch (error) {
         // Pass error to the central error handler
        console.error("Error in /api/gemini/report:", error.response?.data || error.message);
        next(error); // Forward error to the error handling middleware
      }
    });

    app.post("/api/gemini/chat", async (req, res, next) => { // Added next
      try {
        const { message } = req.body;

        if (!message) {
          return res.status(400).json({ success: false, message: "Message is required." });
        }
        console.log("Received chat message:", message);

        const inputData = {
          contents: [ { parts: [ { text: message } ] } ],
        };

        // Call the Gemini AI API (ensure GEMINI_API_KEY is set in .env)
         const aiResponse = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, // Corrected endpoint structure
          inputData,
          { headers: { "Content-Type": "application/json" } } // API key is in URL now
        );

        // Check for response structure and potential errors from Gemini API
       if (aiResponse.data && aiResponse.data.candidates && aiResponse.data.candidates[0].content) {
          res.status(200).json({
            success: true,
            response: aiResponse.data.candidates[0].content.parts[0].text,
          });
        } else {
          console.error("Unexpected AI API chat response structure:", aiResponse.data);
           const errorMessage = aiResponse.data?.error?.message || "Failed to process chat: Unexpected AI response.";
          res.status(500).json({ success: false, message: errorMessage });
        }
      } catch (error) {
        // Pass error to the central error handler
        console.error("Error in /api/gemini/chat:", error.response?.data || error.message);
        next(error); // Forward error to the error handling middleware
      }
    });

    // --- Static File Serving ---
    // Serve files from the 'uploads' directory (make sure this directory exists)
    // Creates a virtual path '/uploads' mapped to the physical './uploads' directory
    app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
    console.log(`Serving static files from: ${path.join(__dirname, '../uploads')}`);

    // --- Default Route ---
    // A simple welcome message for the root URL
    app.get("/", (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.send("<h1>Welcome to the Local Service App API</h1><p>API endpoints are available under /api/...</p>");
    });

    // --- Catch-all for undefined routes (404 Not Found) ---
    // This should be placed after all other routes
    app.use((req, res, next) => {
        res.status(404).json({ success: false, message: `Cannot ${req.method} ${req.originalUrl}` });
    });


    // --- Central Error Handling Middleware ---
    // Must have 4 arguments (err, req, res, next) to be recognized as an error handler
    app.use((err, req, res, next) => {
      console.error("Unhandled Error:", err.stack || err); // Log the full error stack

      // Check if the error is a CORS error
      if (err.message === "Not allowed by CORS") {
        return res.status(403).json({ // Use 403 Forbidden for CORS issues
             success: false,
             message: "Origin not allowed by CORS policy."
         });
      }

       // Determine status code - use error's status or default to 500
      const statusCode = err.status || err.statusCode || 500;

      // Send JSON response
      res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        // Optionally include stack trace in development
        // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      });
    });


    // --- Start the Server ---
    const PORT = process.env.PORT || 5000;
    // Listen on 0.0.0.0 to accept connections from any network interface (important for Render/Docker)
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server successfully started and running on http://localhost:${PORT} (accessible externally if configured)`);
    });

  })
  .catch((err) => {
    // Handle initial database connection errors
    console.error("FATAL: Failed to connect to the database. Server cannot start.");
    console.error(err);
    process.exit(1); // Exit the process with an error code
  });
