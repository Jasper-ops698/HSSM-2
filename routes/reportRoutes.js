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
const authMiddleware = require('../middlewares/authMiddleware');
const { verifyRole } = require('../middlewares/verifyRole');

const hssmProviderOnly = verifyRole(['HSSM-provider']);

// Generate a new report
router.post('/generate', authMiddleware, hssmProviderOnly, generateReport);

// Get all reports for the user
router.get('/', authMiddleware, hssmProviderOnly, getReports);

// Get a single report
router.get('/:id', authMiddleware, hssmProviderOnly, getReportById);

// Update a report
router.put('/:id', authMiddleware, hssmProviderOnly, updateReport);

// Delete a report
router.delete('/:id', authMiddleware, hssmProviderOnly, deleteReport);

// Download a report as PowerPoint
router.get('/:id/download', authMiddleware, hssmProviderOnly, downloadReport);

module.exports = router;
