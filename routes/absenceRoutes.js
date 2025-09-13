const express = require('express');
const router = express.Router();
const absenceController = require('../controllers/absenceController');
const { protect } = require('../middlewares/authMiddleware');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const verifyRole = require('../middlewares/verifyRole');

// Apply for absence (student/teacher)
router.post('/', protect, upload.single('evidence'), absenceController.applyAbsence);

// List absences
router.get('/', protect, absenceController.listAbsences);

// Get absences for teacher's classes
router.get('/teacher', protect, verifyRole(['teacher', 'HOD', 'admin']), absenceController.getAbsencesForTeacher);

// Approve or reject absence request
router.post('/respond', protect, verifyRole(['teacher', 'HOD', 'admin']), absenceController.respondToAbsence);

module.exports = router;
