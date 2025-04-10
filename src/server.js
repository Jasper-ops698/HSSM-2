const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression"); // For response compression
const connectToDatabase = require("./db");
const axios = require("axios"); // Import axios for making API requests

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

const allowedOrigins = ["https://hssm-sevices-page.onrender.com"]; // Default origin

if (process.env.ALLOWED_ORIGINS) {
  const additionalOrigins = process.env.ALLOWED_ORIGINS.split(",");
  allowedOrigins.push(...additionalOrigins); // Add origins from env variable
}
// Configure CORS
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests from allowed origins or from non-browser tools (e.g., Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true); // Allow request
    } else {
      callback(new Error("CORS Error: Origin not allowed")); // Block request
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // HTTP methods allowed
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"], // Headers allowed
  credentials: false, // Set to true only if you need cookies or auth headers
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight (OPTIONS) requests
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

    // Route for Gemini AI Report Generation
    app.post("/api/gemini/report", async (req, res) => {
      try {
        const { userId, startDate, endDate } = req.body;

        if (!userId || !startDate || !endDate) {
          return res.status(400).json({
            success: false,
            message: "Missing required fields: userId, startDate, or endDate",
          });
        }

        // Fetch user-specific data from the database
        const incidents = await IncidentModel.find({ userId, date: { $gte: startDate, $lte: endDate } });
        const assets = await AssetModel.find({ userId });
        const tasks = await TaskModel.find({ userId, dueDate: { $gte: startDate, $lte: endDate } });
        const meterReadings = await MeterReadingModel.find({ userId, date: { $gte: startDate, $lte: endDate } });

        // Prepare data for the AI API
        const inputData = {
          contents: [
            {
              parts: [
                {
                  text: `Generate a report for the following data:\n\nSummary:\n- Total Assets: ${assets.length}\n- Pending Incidents: ${incidents.length}\n- Maintenance Tasks: ${tasks.length}\n\nMeter Readings:\n${meterReadings
                    .map((reading, index) => `Location ${index + 1}: ${reading.location} (${reading.reading} readings)`)
                    .join("\n")}\n\nDetailed Data:\nIncidents: ${JSON.stringify(incidents, null, 2)}\nAssets: ${JSON.stringify(
                    assets,
                    null,
                    2
                  )}\nTasks: ${JSON.stringify(tasks, null, 2)}`,
                },
              ],
            },
          ],
        };

        // Call the Gemini AI API
        const aiResponse = await axios.post(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
          inputData,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.GEMINI_API_KEY}`, // Use your AI API key
            },
          }
        );

        if (aiResponse.status === 200) {
          res.status(200).json({
            success: true,
            report: aiResponse.data.contents[0].parts[0].text, // Assuming the AI API returns the report in this structure
          });
        } else {
          res.status(aiResponse.status).json({
            success: false,
            message: aiResponse.data.message || "Failed to generate report using AI API",
          });
        }
      } catch (error) {
        console.error("Error generating report:", error);
        res.status(500).json({
          success: false,
          message: "Failed to generate report",
        });
      }
    });

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
