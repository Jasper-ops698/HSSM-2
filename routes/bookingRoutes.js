const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

// Get all available venues
router.get('/venues', protect, bookingController.getVenues);

// Check venue availability
router.post('/availability', protect, bookingController.checkAvailability);

// Create a new booking
router.post('/', protect, verifyRole(['teacher', 'HOD']), bookingController.createBooking);

// Get bookings for the logged-in user
router.get('/my-bookings', protect, bookingController.getUserBookings);

module.exports = router;
