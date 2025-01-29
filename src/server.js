const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression"); // For response compression
const connectToDatabase = require("./db");

dotenv.config(); // Load environment variables

const app = express();

// Middleware: Security and Performance
app.use(helmet()); // Secure HTTP headers
app.use(compression()); // Compress response bodies
app.use(morgan("common")); // Log requests with less verbosity in production

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { message: "Too many requests, please try again later." },
});
app.use(limiter);

// CORS Configuration
// Dynamic CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000"]; // Default to localhost in dev

console.log("Allowed Origins:", allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    console.log("Incoming request from origin:", origin); // Debug log for origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true); // Allow the request
    } else {
      console.error("Blocked by CORS:", origin); // Debug for blocked origins
      callback(new Error("Origin not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed HTTP methods
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "x-auth-token",
  ], // Allowed custom headers
  credentials: true, // Allow cookies and credentials
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Preflight requests handler
app.options("*", cors(corsOptions));

// Middleware for parsing requests
app.use(express.json({ limit: "10kb" })); // Limit JSON payload size

// Connect to Database
connectToDatabase()
  .then(() => {
    console.log("Connected to the database.");

    // Import routes
    const serviceRoutes = require("../routes/serviceRoutes");
    const authRoutes = require("../routes/authRoutes");
    const requestRoutes = require("../routes/requestRoutes");
    const dashboardRoutes = require("../routes/dashboardRoutes");
    const adminRoutes = require("../routes/adminRoutes");
    const HssmRoutes = require("../routes/HssmRoutes");

    // Route Middleware
    app.use("/api/auth", authRoutes);
    app.use("/api/services", serviceRoutes);
    app.use("/api/requests", requestRoutes);
    app.use("/api/dashboard", dashboardRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/hssm", HssmRoutes);

    // Static File Serving (e.g., file uploads)
    app.use("/uploads", express.static("uploads"));

    // Default Route
    app.get("/", (req, res) => {
      res.send("Welcome to the Local Service App API");
    });

    // Error Handling Middleware
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
      });
    });

    // Start the Server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to the database:", err);
  });
