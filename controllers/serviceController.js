const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Service = require('../models/Service');
const upload = require('../middlewares/multerSetup');

// Create service with image upload handling (store file path in MongoDB)
exports.createService = [
  async (req, res, next) => {
    try {
      if (req.user.role !== 'service-provider' && req.user.role !== 'admin') {
        return next(new Error('Only service providers or admins can create services'));
      }

      let imagePath = '';
      if (req.file) {
        imagePath = req.file.path;
      }

      const service = await Service.create({
        provider: req.user._id,
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        image: imagePath, // Save file path to MongoDB
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
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return next(new Error(`Service not found with id of ${id}`));
    }

    if (service.provider.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new Error(`You can only delete your own services or if you are an admin`));
    }

    // Delete the image file from the server
    if (service.image) {
      fs.unlinkSync(service.image);
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

      let imagePath = service.image;
      if (req.file) {
        // Delete the old image file from the server
        if (imagePath) {
          fs.unlinkSync(imagePath);
        }
        imagePath = req.file.path;
      }

      service = await Service.findByIdAndUpdate(
        id,
        {
          name: req.body.name,
          description: req.body.description,
          price: req.body.price,
          image: imagePath, // Update file path in MongoDB
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
