const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
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
router.post('/assignRole', protect, assignUserRole);

// Add a staff member
router.post('/addStaff', protect, addStaff);

// Delete a staff member
router.delete('/staff/:id', protect, deleteStaff);

// Disable a staff member
router.put('/staff/:id/disable', protect, disableStaff);

// Delete an HSSM provider
router.delete('/hssmProvider/:id', protect, deleteHssmProvider);

// Disable an HSSM provider
router.put('/hssmProvider/:id/disable', protect, disableHssmProvider);

// Fetch all reports of a specific HSSM provider based on ID
router.get('/hssmProviderReports/:providerId', protect, getAllData); // If you want a specific handler, replace getAllData

// Fetch analytics data
router.get('/analytics', protect, getAllData);

// Fetch all HSSM provider reports
router.get('/hssmProviderReports', protect, getAllReportsByHSSMProviders);

// Delete a user
router.delete('/users/:id', protect, deleteUser);

// Delete a report by ID
router.delete('/hssmProviderReports/:id', protect, deleteHssmProviderReport);

module.exports = router;
