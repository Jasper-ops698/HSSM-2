const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const dashboardController = require('../controllers/dashboardControllers'); 

const router = express.Router();

router.get('/', protect, dashboardController.getDashboard); 

module.exports = router;