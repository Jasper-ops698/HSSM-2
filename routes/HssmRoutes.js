const express = require('express');
const router = express.Router();
const {
  createIncident,
  getAllIncidents,
  updateIncident,
  deleteIncident,
  createAsset,
  getAllAssets,
  updateAsset,
  deleteAsset,
  createTask,
  getAllTasks,
  updateTask,
  deleteTask,
  createMeterReading,
  getAllMeterReadings,
  updateMeterReading,
  deleteMeterReading,
  createHospitalProfile,
  getHospitalProfile,
  updateHospitalProfile,
  shareHospitalProfile,
  getAllReports,
  getMeterReadingTrend,
} = require('../controllers/HssmController');
const { protect } = require('../middlewares/authMiddleware'); // Correctly import 'protect'
const verifyRole = require('../middlewares/verifyRole');
const upload = require('../middlewares/multerSetup');
const uploadDocument = upload.uploadDocument;

// --- Incident Routes ---
router.post('/incidents', protect, verifyRole(['HSSM-provider']), upload.single('file'), createIncident);
router.get('/incidents', protect, verifyRole(['HSSM-provider']), getAllIncidents);
router.put('/incidents/:id', protect, verifyRole(['HSSM-provider']), upload.single('file'), updateIncident);
router.delete('/incidents/:id', protect, verifyRole(['HSSM-provider']), deleteIncident);

// --- Asset Routes ---
router.post('/assets', protect, verifyRole(['HSSM-provider']), upload.single('file'), createAsset);
router.get('/assets', protect, verifyRole(['HSSM-provider']), getAllAssets);
router.put('/assets/:id', protect, verifyRole(['HSSM-provider']), upload.single('file'), updateAsset);
router.delete('/assets/:id', protect, verifyRole(['HSSM-provider']), deleteAsset);

// --- Task Routes ---
router.post('/tasks', protect, verifyRole(['HSSM-provider']), createTask);
router.get('/tasks', protect, verifyRole(['HSSM-provider']), getAllTasks);
router.put('/tasks/:id', protect, verifyRole(['HSSM-provider']), updateTask);
router.delete('/tasks/:id', protect, verifyRole(['HSSM-provider']), deleteTask);

// --- Meter Reading Routes ---
router.post('/meter-readings', protect, verifyRole(['HSSM-provider']), createMeterReading);
router.get('/meter-readings', protect, verifyRole(['HSSM-provider']), getAllMeterReadings);
router.put('/meter-readings/:id', protect, verifyRole(['HSSM-provider']), updateMeterReading);
router.delete('/meter-readings/:id', protect, verifyRole(['HSSM-provider']), deleteMeterReading);
router.get('/meter-readings/trend', protect, verifyRole(['HSSM-provider']), getMeterReadingTrend);

// --- Hospital Profile Routes ---
router.post('/profile', protect, verifyRole(['HSSM-provider']), uploadDocument.single('organogram'), createHospitalProfile);
router.get('/profile', protect, verifyRole(['HSSM-provider']), getHospitalProfile);
router.put('/profile', protect, verifyRole(['HSSM-provider']), uploadDocument.single('organogram'), updateHospitalProfile);
router.post('/share-profile', protect, verifyRole(['HSSM-provider']), shareHospitalProfile);

// --- Report Routes ---
router.get('/reports', protect, verifyRole(['HSSM-provider']), getAllReports);

module.exports = router;