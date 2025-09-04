const express = require('express');
const router = express.Router();
const {
    generateReport,
    getReports,
    getReportById,
    updateReport,
    deleteReport,
    downloadReport,
} = require('../controllers/reportController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

const hssmProviderOnly = verifyRole(['HSSM-provider']);

// Generate a new report
router.post('/generate', protect, hssmProviderOnly, generateReport);

// Get all reports for the user
router.get('/', protect, hssmProviderOnly, getReports);

// Get a single report
router.get('/:id', protect, hssmProviderOnly, getReportById);

// Update a report
router.put('/:id', protect, hssmProviderOnly, updateReport);

// Delete a report
router.delete('/:id', protect, hssmProviderOnly, deleteReport);

// Download a report as PowerPoint
router.get('/:id/download', protect, hssmProviderOnly, downloadReport);

module.exports = router;
