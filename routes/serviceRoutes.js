const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
  createService,
  getServices,
  updateService,
  deleteService,
} = require('../controllers/serviceController');
const upload = require('../middlewares/multerSetup'); // Assuming multer setup is in this file
const { check } = require('express-validator');
const User = require('../models/User');  // Ensure User model is imported
const Service = require('../models/Service'); // Ensure Service model is imported

const router = express.Router();

// Create Service (Requires Authentication)
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price } = req.body;
    const imagePath = req.file ? req.file.path : ''; // Use uploaded image path

    const service = new Service({
      provider: req.user._id,
      name,
      description,
      price,
      image: imagePath,
    });

    await service.save();
    res.status(201).json({ message: 'Service created successfully', service });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create service', error });
  }
});

// Get Services (Allow Admin, Service Provider, Individual Access)
router.get('/provider', protect, getServices);

// Update Service (Requires Authentication and Authorization)
router.put(
  '/:id',
  protect,
  upload.single('image'), // Optional image upload for update
  [
    check('name').optional().notEmpty().withMessage('Service name is required'),
    check('description').optional().notEmpty().withMessage('Service description is required'),
    check('price').optional().isNumeric().withMessage('Price must be a number'),
  ],
  updateService
);

// Get Device Token of a Service Provider based on service type
router.get('/provider/:deviceToken/:serviceType', async (req, res) => {
  const { serviceType } = req.params;
  try {
    const serviceProvider = await User.findOne({
      role: 'service-provider',
      services: serviceType,
    });

    if (serviceProvider && serviceProvider.deviceToken) {
      res.json({ deviceToken: serviceProvider.deviceToken });
    } else {
      res.status(404).json({ message: 'Device token not found for the selected service provider.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve device token.', error });
  }
});

// Get all services
router.get('/', protect, async (req, res) => {
  try {
    const services = await Service.find({});
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve services.', error });
  }
});

// Delete Service (Requires Authentication and Authorization)
router.delete('/:id', protect, deleteService);

module.exports = router;
