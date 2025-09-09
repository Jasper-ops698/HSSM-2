const axios = require("axios");

const generateReport = async (req, res, next) => {
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
};

const chatWithAI = async (req, res, next) => {
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
};

module.exports = {
  generateReport,
  chatWithAI,
};
