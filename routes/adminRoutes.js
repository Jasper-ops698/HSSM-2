const express = require('express');
const router = express.Router();
const { 
    assignUserRole,
    addStaff, 
    deleteStaff, 
    getAllData, 
    getAllReportsByHSSMProviders, 
    deleteUser, 
    deleteHssmProviderReport, 
    disableStaff, 
    deleteHssmProvider, 
    disableHssmProvider 
} = require('../controllers/adminController');

// Assign role to a staff (teacher, credit-controller, HOD)
router.post('/assignRole', assignUserRole);

// Add a staff member
router.post('/addStaff', addStaff);

// Delete a staff member
router.delete('/staff/:id', deleteStaff);

// Disable a staff member
router.put('/staff/:id/disable', disableStaff);

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
