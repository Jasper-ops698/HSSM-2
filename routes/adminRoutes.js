const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');
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
    disableHssmProvider,
    downloadDepartmentReportCsv
} = require('../controllers/adminController');
// Download department activity report as CSV (admin only)
router.get('/department-report-csv', protect, verifyRole(['admin']), downloadDepartmentReportCsv);

// Assign role to a staff (teacher, credit-controller, HOD)
router.post('/assignRole', protect, verifyRole(['admin']), assignUserRole);

// Add a staff member
router.post('/addStaff', protect, verifyRole(['admin']), addStaff);

// Delete a staff member
router.delete('/staff/:id', protect, verifyRole(['admin']), deleteStaff);

// Disable a staff member
router.put('/staff/:id/disable', protect, verifyRole(['admin']), disableStaff);

// Delete an HSSM provider
router.delete('/hssmProvider/:id', protect, verifyRole(['admin']), deleteHssmProvider);

// Disable an HSSM provider
router.put('/hssmProvider/:id/disable', protect, verifyRole(['admin']), disableHssmProvider);

// Fetch all reports of a specific HSSM provider based on ID
router.get('/hssmProviderReports/:providerId', protect, verifyRole(['admin']), getAllData); // If you want a specific handler, replace getAllData

// Fetch analytics data
router.get('/analytics', protect, verifyRole(['admin']), getAllData);

// Fetch all HSSM provider reports
router.get('/hssmProviderReports', protect, verifyRole(['admin']), getAllReportsByHSSMProviders);

// Delete a user
router.delete('/users/:id', protect, verifyRole(['admin']), deleteUser);

// Delete a report by ID
router.delete('/hssmProviderReports/:id', protect, verifyRole(['admin']), deleteHssmProviderReport);

module.exports = router;
