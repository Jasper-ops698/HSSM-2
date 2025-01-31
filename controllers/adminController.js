const User = require('../models/User');
const Request = require('../models/Request');
const Service = require('../models/Service');
const { validationResult } = require('express-validator');

// Get all users, requests, and services for analytics
exports.getAllData = async (req, res) => {
  try {
    const [users, requests, services] = await Promise.all([
      User.find(),
      Request.find(),
      Service.find(),
    ]);

    // Preparing data for analytics
    const totalUsers = users.length;
    const totalRequests = requests.length;
    const totalServices = services.length;

    // Pie charts data preparation
    const userRoles = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    const requestStatuses = requests.reduce((acc, request) => {
      acc[request.status] = (acc[request.status] || 0) + 1;
      return acc;
    }, {});

    const servicesCount = services.reduce((acc, service) => {
      acc[service.name] = (acc[service.name] || 0) + 1;
      return acc;
    }, {});

    res.json({
      users,
      requests,
      services,
      totalUsers,
      totalRequests,
      totalServices,
      userRoles,
      requestStatuses,
      servicesCount,
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ msg: 'Error fetching data', error: error.message });
  }
};

// Delete a service provider by ID
exports.deleteServiceProvider = async (req, res) => {
  try {
    const { id } = req.params;

    const serviceProvider = await User.findById(id);
    if (!serviceProvider) {
      return res.status(404).json({ msg: 'Service provider not found.' });
    }

    // Remove service provider
    await serviceProvider.deleteOne();
    res.json({ msg: 'Service provider deleted successfully.' });
  } catch (error) {
    console.error('Error deleting service provider:', error);
    res.status(500).json({ msg: 'Error deleting service provider', error: error.message });
  }
};

// Add a new service provider
exports.addServiceProvider = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ msg: 'All fields are required.' });
    }

    // Check if the service provider already exists
    const existingServiceProvider = await User.findOne({ email });
    if (existingServiceProvider) {
      // If the service provider exists but is disabled, enable them
      if (existingServiceProvider.disabled) {
        existingServiceProvider.disabled = false;
        await existingServiceProvider.save();
        return res.status(200).json({ msg: 'Service provider re-enabled successfully.' });
      }
      return res.status(400).json({ msg: 'Service provider with this email already exists.' });
    }

    // Create a new service provider
    const newServiceProvider = new User({
      name,
      email,
      password,
      role: 'service-provider',
    });

    await newServiceProvider.save();
    res.status(201).json({ msg: 'Service provider added successfully.' });
  } catch (error) {
    console.error('Error adding service provider:', error);
    res.status(500).json({ msg: 'Error adding service provider', error: error.message });
  }
};

// Get all reports generated by HSSM providers
exports.getAllReportsByHSSMProviders = async (req, res) => {
  try {
    const hssmProviders = await User.find({ role: 'HSSM-provider' });

    const reports = await Promise.all(
      hssmProviders.map(provider => 
        Request.find({ providerId: provider._id })
      )
    );

    res.json({
      hssmProviders,
      reports,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ msg: 'Error fetching reports', error: error.message });
  }
};