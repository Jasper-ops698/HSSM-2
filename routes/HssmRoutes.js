const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const axios = require('axios');
const {
    getServicesByLevel,
    createIncident, getAllIncidents,
    createAsset, getAllAssets,
    createTask, getAllTasks,
    createMeterReading, getAllMeterReadings, getMeterReadingTrend,
    generateReport, getAllReports,
    getHospitalProfile, updateHospitalProfile,
    uploadTechnicalPlan, deleteTechnicalPlan
} = require('../controllers/HssmController');
const { Incident, Asset, Task, MeterReading, HospitalProfile, upload } = require('../models/Hssm');

const router = express.Router();

// AI-powered report generation
router.post('/report/generate', protect, async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        const userId = req.user._id;

        // Gather data
        const incidents = await Incident.find({ userId });
        const assets = await Asset.find({ userId });
        const tasks = await Task.find({ userId });
        const meterReadings = await MeterReading.find({ 
            userId,
            date: { $gte: new Date(startDate), $lte: new Date(endDate) }
        });
        const profile = await HospitalProfile.findOne({ userId });

        // Create a detailed context for the AI
        const context = `Generate a detailed technical report for a Hospital Service & Support Management (HSSM) system with the following data:

Period: ${startDate} to ${endDate}

Hospital Profile:
- Mission: ${profile?.mission || 'Not set'}
- Vision: ${profile?.vision || 'Not set'}
- Service Charter: ${profile?.serviceCharter || 'Not set'}

Statistics:
- Total Assets: ${assets.length}
  * Categories: ${Array.from(new Set(assets.map(a => a.category))).join(', ')}
- Total Incidents: ${incidents.length}
  * High Priority: ${incidents.filter(i => i.priority === 'High').length}
  * Medium Priority: ${incidents.filter(i => i.priority === 'Medium').length}
  * Low Priority: ${incidents.filter(i => i.priority === 'Low').length}
- Total Tasks: ${tasks.length}
  * Completed: ${tasks.filter(t => t.status === 'completed').length}
  * Pending: ${tasks.filter(t => t.status === 'pending').length}
- Total Meter Readings: ${meterReadings.length}

Key Metrics:
1. Asset Utilization Rate: ${(tasks.length / assets.length * 100).toFixed(2)}%
2. Incident Resolution Rate: ${(incidents.filter(i => i.status === 'resolved').length / incidents.length * 100).toFixed(2)}%
3. Task Completion Rate: ${(tasks.filter(t => t.status === 'completed').length / tasks.length * 100).toFixed(2)}%

Please provide:
1. Executive Summary
2. Detailed Analysis of each metric
3. Trends and Patterns
4. Areas of Improvement
5. Recommendations`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [
                    {
                        parts: [
                            {
                                text: context
                            }
                        ]
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const generatedReport = response.data.candidates[0].content.parts[0].text;
            res.json({ success: true, report: generatedReport });
        } else {
            throw new Error('Failed to generate report content');
        }
    } catch (error) {
        console.error('Report generation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to generate report. Please try again.' 
        });
    }
});

// Hospital Level Routes
router.get('/hospitalLevels/:level/services', protect, getServicesByLevel);

// Incident Routes
router.post('/incidents', protect, createIncident);
router.get('/incidents', protect, getAllIncidents);

// Asset Routes
router.post('/assets', protect, createAsset);
router.get('/assets', protect, getAllAssets);

// Task Routes
router.post('/tasks', protect, createTask);
router.get('/tasks', protect, getAllTasks);

// Meter Reading Routes
router.post('/meterReadings', protect, createMeterReading);
router.get('/meterReadings', protect, getAllMeterReadings);

// Meter Reading Trend Route
router.get('/meterReadings/trend', protect, getMeterReadingTrend);

// Report Routes
router.post('/report/generate', protect, generateReport);
router.get('/reports', protect, getAllReports);

// Hospital Profile Routes
router.get('/profile', protect, getHospitalProfile);
router.put('/profile', protect, upload.fields([
    { name: 'organogram', maxCount: 1 }
]), protect, updateHospitalProfile);

// Technical Plans Routes
router.post('/profile/technical-plans', protect, upload.single('file'), uploadTechnicalPlan);
router.delete('/profile/technical-plans/:planId', protect, deleteTechnicalPlan);

module.exports = router;
