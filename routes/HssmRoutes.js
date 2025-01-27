const express = require('express');
const upload = require('../models/Hssm').upload;
const { 
    createIncident, getAllIncidents, 
    createAsset, getAllAssets, 
    createTask, getAllTasks, 
    createMeterReading, getAllMeterReadings,
    createReport, getAllReports 
} = require('../controllers/HssmController');

const router = express.Router();

// Incident Routes
router.post('/incidents', upload.single('file'), createIncident);
router.get('/incidents', getAllIncidents);

// Asset Routes
router.post('/assets', upload.single('file'), createAsset);
router.get('/assets', getAllAssets);

// Task Routes
router.post('/tasks', upload.single('file'), createTask);
router.get('/tasks', getAllTasks);

// Meter Reading Routes
router.post('/meterReadings', upload.none(), createMeterReading); // no file upload, but form data
router.get('/meterReadings', getAllMeterReadings);

// Report Routes
router.post('/reports', upload.single('file'), createReport);
router.get('/reports', getAllReports);

module.exports = router;
