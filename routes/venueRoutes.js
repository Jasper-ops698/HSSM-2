const express = require('express');
const router = express.Router();
const {
  getVenues,
  createVenue,
  updateVenue,
  deleteVenue,
  getAvailableVenues,
  assignVenue,
} = require('../controllers/venueController');
const { protect, admin, teacher } = require('../middlewares/authMiddleware');

router.route('/').get(protect, getVenues).post(protect, admin, createVenue);
router.route('/available').get(protect, getAvailableVenues);
router.route('/assign').post(protect, teacher, assignVenue);

router
  .route('/:id')
  .put(protect, admin, updateVenue)
  .delete(protect, admin, deleteVenue);

module.exports = router;
