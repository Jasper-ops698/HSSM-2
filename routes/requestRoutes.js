const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { 
  createRequest, 
  getUserRequests, 
  updateRequestStatus, 
  addImageToRequest, 
  getProviderRequests, 
  submitReview
} = require('../controllers/requestControllers');
const upload = require('../middlewares/multerSetup'); // Assuming multer setup is in this file

const router = express.Router();

// Create Request (Requires Authentication)
router.post('/', protect, createRequest); 

// Submit Review (Requires Authentication)
router.post('/reviews', protect, submitReview);

// Get User Requests (Requires Authentication)
router.get('/user', protect, getUserRequests);

// Get Provider Requests (Requires Authentication)
router.get('/provider', protect, getProviderRequests);

// Update Request Status (Requires Authentication)
router.put('/:id', protect, updateRequestStatus);

// Add Image to Request (Requires Authentication)
router.put('/:id/image', protect, upload.single('image'), addImageToRequest);

module.exports = router;
