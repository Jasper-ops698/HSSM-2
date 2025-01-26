const multer = require('multer');
const Service = require('../models/Service');
const upload = require('../middlewares/multerSetup');

// Multer setup for memory storage (storing file in memory)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|gif/;
  const extname = allowedFileTypes.test(file.originalname.toLowerCase());
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Create service with image upload handling (store in MongoDB)
exports.createService = [
  upload.single('image'),
  async (req, res, next) => {
    try {
      if (req.user.role !== 'service-provider' && req.user.role !== 'admin') {
        return next(new Error('Only service providers or admins can create services'));
      }

      let imageBase64 = '';
      if (req.file) {
        // Convert the uploaded file to Base64
        imageBase64 = req.file.buffer.toString('base64');
      }

      const service = await Service.create({
        provider: req.user._id,
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        image: imageBase64, // Save Base64 string to MongoDB
      });

      res.status(201).json({
        success: true,
        data: service,
      });
    } catch (error) {
      next(error);
    }
  },
];

// Delete service remains unchanged
exports.deleteService = async (req, res, next) => {
  const { id } = req.params;

  try {
    const service = await Service.findById(id);

    if (!service) {
      return next(new Error(`Service not found with id of ${id}`));
    }

    if (service.provider.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new Error(`You can only delete your own services or if you are an admin`));
    }

    await service.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// Get all services 
exports.getServices = async (req, res, next) => {
  try {
    const services = await Service.find();
    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    next(error);
  }
};

// Update services
exports.updateService = [
  upload.single('image'),
  async (req, res, next) => {
    const { id } = req.params;

    try {
      let service = await Service.findById(id);

      if (!service) {
        return next(new Error(`Service not found with id of ${id}`));
      }

      if (service.provider.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return next(new Error(`You can only update your own services or if you are an admin`));
      }

      let imageBase64 = service.image;
      if (req.file) {
        // Convert the uploaded file to Base64
        imageBase64 = req.file.buffer.toString('base64');
      }

      service = await Service.findByIdAndUpdate(
        id,
        {
          name: req.body.name,
          description: req.body.description,
          price: req.body.price,
          image: imageBase64, // Update Base64 string in MongoDB
        },
        { new: true, runValidators: true }
      );

      res.status(200).json({
        success: true,
        data: service,
      });
    } catch (error) {
      next(error);
    }
  },
];