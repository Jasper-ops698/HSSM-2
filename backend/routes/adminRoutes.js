const express = require('express');
const router = express.Router();
const { addServiceProvider, deleteServiceProvider, getAllData, getAllReportsByHSSMProviders } = require('../controllers/adminController');

// Add a service provider
router.post('/serviceProvider', addServiceProvider);

// Delete a service provider
router.delete('/serviceProvider/:id', deleteServiceProvider);

// Disable a service provider
router.put('/serviceProvider/:id/disable', getAllData);

// Delete an HSSM provider
router.delete('/hssmProvider/:id', getAllData);

// Disable an HSSM provider
router.put('/hssmProvider/:id/disable', getAllData);

// Fetch all reports of a specific HSSM provider based on ID
router.get('/hssmProviderReports/:providerId', getAllData);

// Fetch analytics data
router.get('/analytics', getAllData);

// Fetch all HSSM provider reports
router.get('/hssmProviderReports', getAllReportsByHSSMProviders);

module.exports = router;
