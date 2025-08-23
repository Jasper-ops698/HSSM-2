const { assignUserRole } = require('../controllers/adminController');
// Assign role to a service-provider (teacher, credit-controller, HOD)
router.post('/assignRole', assignUserRole);
const express = require('express');
const router = express.Router();
const { addServiceProvider, deleteServiceProvider, getAllData, getAllReportsByHSSMProviders, deleteUser, deleteHssmProviderReport, disableServiceProvider, deleteHssmProvider, disableHssmProvider } = require('../controllers/adminController');

// Add a service provider
router.post('/addProvider', addServiceProvider);

// Delete a service provider
router.delete('/serviceProvider/:id', deleteServiceProvider);

// Disable a service provider
router.put('/serviceProvider/:id/disable', disableServiceProvider);

// Delete an HSSM provider
router.delete('/hssmProvider/:id', deleteHssmProvider);

// Disable an HSSM provider
router.put('/hssmProvider/:id/disable', disableHssmProvider);

// Fetch all reports of a specific HSSM provider based on ID
router.get('/hssmProviderReports/:providerId', getAllData); // If you want a specific handler, replace getAllData

// Fetch analytics data
router.get('/analytics', getAllData);

// Fetch all HSSM provider reports
router.get('/hssmProviderReports', getAllReportsByHSSMProviders);

// Delete a user
router.delete('/users/:id', deleteUser);

// Delete a report by ID
router.delete('/hssmProviderReports/:id', deleteHssmProviderReport);

module.exports = router;
