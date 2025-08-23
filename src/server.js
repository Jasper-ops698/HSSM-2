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

// Load environment variables from .env file
dotenv.config();

// Initialize Express app
const app = express();

// --- Database Connection and Route Setup ---
connectToDatabase()
  .then(() => {
    // --- Import Routes ---
    const serviceRoutes = require("../routes/serviceRoutes");
    const authRoutes = require("../routes/authRoutes");
    const requestRoutes = require("../routes/requestRoutes");
    const dashboardRoutes = require("../routes/dashboardRoutes");
    const adminRoutes = require("../routes/adminRoutes");
    const HssmRoutes = require("../routes/HssmRoutes");
    const chatRoutes = require('../routes/chatRoutes');
    const twofaRoutes = require('../routes/twofaRoutes');
    const googleAuthRoutes = require('../routes/googleAuthRoutes');
    const absenceRoutes = require('../routes/absenceRoutes');

    // --- API Route Middleware ---
    app.use("/api/auth", authRoutes);
    app.use("/api/auth", googleAuthRoutes); // Add Google Auth route
    app.use("/api/services", serviceRoutes);
    app.use("/api/requests", requestRoutes);
    app.use("/api/dashboard", dashboardRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/hssm", HssmRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/2fa', twofaRoutes);
    app.use('/api/absences', absenceRoutes);

    // --- Gemini AI Routes ---
    app.post("/api/gemini/report", async (req, res, next) => {
      try {
        const { userId, startDate, endDate } = req.body;
        if (!userId || !startDate || !endDate) {
          return res.status(400).json({
            success: false,
            message: "Missing required fields: userId, startDate, or endDate",
          });
        }
        const { Incident, Asset, Task, MeterReading, HospitalProfile } = require('../models/Hssm');
        const profile = await HospitalProfile.findOne({ userId });
        const incidents = await Incident.find({ userId, date: { $gte: new Date(startDate), $lte: new Date(endDate) } });
        const assets = await Asset.find({ userId });
        const tasks = await Task.find({ userId, dueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } });
        const meterReadings = await MeterReading.find({ userId, date: { $gte: new Date(startDate), $lte: new Date(endDate) } });
        const inputData = {
          contents: [ { parts: [ {
                text: `Generate a comprehensive technical and management report for a hospital with the following profile and operational data.\n\nMission: ${profile?.mission || 'Not set'}\nVision: ${profile?.vision || 'Not set'}\nService Charter: ${profile?.serviceCharter || 'Not set'}\n\nAssets: ${assets.length}\nIncidents: ${incidents.length}\nTasks: ${tasks.length}\nMeter Readings: ${meterReadings.length}\n\nDetailed Data (for context):\nIncidents: ${JSON.stringify(incidents)}\nAssets: ${JSON.stringify(assets)}\nTasks: ${JSON.stringify(tasks)}\nMeter Readings: ${JSON.stringify(meterReadings)}\n\nBased on this, provide:\n- Actionable recommendations for improvement\n- A prediction of the facility's future growth and challenges\n- A summary for management and stakeholders.`
              } ] } ],
        };
        const aiResponse = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          inputData,
          { headers: { "Content-Type": "application/json" } }
        );
        if (aiResponse.data && aiResponse.data.candidates && aiResponse.data.candidates[0].content) {
          res.status(200).json({
            success: true,
            report: aiResponse.data.candidates[0].content.parts[0].text,
          });
        } else {
          const errorMessage = aiResponse.data?.error?.message || "Failed to generate report: Unexpected AI response.";
          res.status(500).json({ success: false, message: errorMessage });
        }
      } catch (error) {
        next(error);
      }
    });

    app.post("/api/gemini/chat", async (req, res, next) => {
      try {
        const { message } = req.body;
        if (!message) {
          return res.status(400).json({ success: false, message: "Message is required." });
        }
        const inputData = {
          contents: [ { parts: [ { text: message } ] } ],
        };
        const aiResponse = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          inputData,
          { headers: { "Content-Type": "application/json" } }
        );
        if (aiResponse.data && aiResponse.data.candidates && aiResponse.data.candidates[0].content) {
          res.status(200).json({
            success: true,
            response: aiResponse.data.candidates[0].content.parts[0].text,
          });
        } else {
          const errorMessage = aiResponse.data?.error?.message || "Failed to process chat: Unexpected AI response.";
          res.status(500).json({ success: false, message: errorMessage });
        }
      } catch (error) {
        next(error);
      }
    });

    // --- Static File Serving ---
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

    // --- Start the Server ---
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });
