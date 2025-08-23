const express = require('express');
const router = express.Router();
const absenceController = require('../controllers/absenceController');
const { protect } = require('../middlewares/authMiddleware');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Apply for absence (student/teacher)
router.post('/', protect, upload.single('evidence'), absenceController.applyAbsence);

// List absences
router.get('/', protect, absenceController.listAbsences);

module.exports = router;
