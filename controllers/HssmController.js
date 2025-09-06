const { HospitalLevel, Incident, Asset, Task, MeterReading, Report, HospitalProfile } = require('../models/Hssm');
const sanitizeHtml = require('sanitize-html');

// Helper function to sanitize input
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return sanitizeHtml(input);
  }
  return input;
};

// --- Incident Controllers ---
const createIncident = async (req, res, next) => {
  try {
    const { department, title, priority, description, date } = req.body;
    const file = req.file ? req.file.filename : null;
    if (!department || !title || !priority || !date) {
      return res.status(400).json({ message: 'Missing required fields: department, title, priority, date' });
    }
    const newIncident = new Incident({
      department: sanitizeInput(department),
      title: sanitizeInput(title),
      priority: sanitizeInput(priority),
      description: sanitizeInput(description),
      date: new Date(date),
      file,
    });
    await newIncident.save();
    res.status(201).json(newIncident);
  } catch (err) {
    next(err);
  }
};

const getAllIncidents = async (req, res, next) => {
  try {
    const incidents = await Incident.find();
    res.status(200).json(incidents);
  } catch (err) {
    next(err);
  }
};

// --- Asset Controllers ---
const createAsset = async (req, res, next) => {
  try {
    const { name, serialNumber, category, location, serviceRecords, facilityLevel } = req.body;
    const file = req.file ? req.file.filename : null;
    if (!name || !serialNumber || !category || !location || !facilityLevel) {
      return res.status(400).json({ message: 'Missing required fields: name, serialNumber, category, location, facilityLevel' });
    }
    const newAsset = new Asset({ name, serialNumber, category, location, serviceRecords, facilityLevel, file });
    await newAsset.save();
    res.status(201).json(newAsset);
  } catch (err) {
    next(err);
  }
};

const getAllAssets = async (req, res, next) => {
  try {
    const assets = await Asset.find();
    res.status(200).json(assets);
  } catch (err) {
    next(err);
  }
};

// --- Task Controllers ---
const createTask = async (req, res, next) => {
  try {
    const { title, description, assignedTo, dueDate, priority } = req.body;
    if (!title || !assignedTo || !dueDate || !priority) {
      return res.status(400).json({ message: 'Missing required fields: title, assignedTo, dueDate, priority' });
    }
    const newTask = new Task({ title, description, assignedTo, dueDate, priority });
    await newTask.save();
    res.status(201).json(newTask);
  } catch (err) {
    next(err);
  }
};

const getAllTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find();
    res.status(200).json(tasks);
  } catch (err) {
    next(err);
  }
};

// --- Meter Reading Controllers ---
const createMeterReading = async (req, res, next) => {
  try {
    const { reading, unit, date } = req.body;
    if (!reading || !unit || !date) {
      return res.status(400).json({ message: 'Missing required fields: reading, unit, date' });
    }
    const newReading = new MeterReading({ reading, unit, date });
    await newReading.save();
    res.status(201).json(newReading);
  } catch (err) {
    next(err);
  }
};

const getAllMeterReadings = async (req, res, next) => {
  try {
    const readings = await MeterReading.find();
    res.status(200).json(readings);
  } catch (err) {
    next(err);
  }
};


// --- ADDED PLACEHOLDER FUNCTIONS ---

const updateIncident = (req, res) => res.status(501).json({ message: 'Not Implemented' });
const deleteIncident = (req, res) => res.status(501).json({ message: 'Not Implemented' });

const updateAsset = (req, res) => res.status(501).json({ message: 'Not Implemented' });
const deleteAsset = (req, res) => res.status(501).json({ message: 'Not Implemented' });

const updateTask = (req, res) => res.status(501).json({ message: 'Not Implemented' });
const deleteTask = (req, res) => res.status(501).json({ message: 'Not Implemented' });

const updateMeterReading = (req, res) => res.status(501).json({ message: 'Not Implemented' });
const deleteMeterReading = (req, res) => res.status(501).json({ message: 'Not Implemented' });

const createHospitalProfile = (req, res) => res.status(501).json({ message: 'Not Implemented' });
const getHospitalProfile = async (req, res) => {
  try {
    const profile = await HospitalProfile.findOne({ userId: req.user.id });
    if (!profile) {
      return res.status(404).json({ message: 'Hospital profile not found' });
    }
    res.status(200).json(profile);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateHospitalProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // Sanitize string inputs
    if (updateData.hospitalName) updateData.hospitalName = sanitizeInput(updateData.hospitalName);
    if (updateData.mission) updateData.mission = sanitizeInput(updateData.mission);
    if (updateData.vision) updateData.vision = sanitizeInput(updateData.vision);
    if (updateData.serviceCharter) updateData.serviceCharter = sanitizeInput(updateData.serviceCharter);

    // Handle location subfields sanitization
    if (updateData.location) {
      if (updateData.location.address) updateData.location.address = sanitizeInput(updateData.location.address);
      if (updateData.location.city) updateData.location.city = sanitizeInput(updateData.location.city);
      if (updateData.location.state) updateData.location.state = sanitizeInput(updateData.location.state);
      if (updateData.location.country) updateData.location.country = sanitizeInput(updateData.location.country);
      if (updateData.location.postalCode) updateData.location.postalCode = sanitizeInput(updateData.location.postalCode);
    }

    // Handle file upload for organogram
    if (req.file) {
      updateData.organogram = req.file.filename;
    }

    // Find and update the profile
    const updatedProfile = await HospitalProfile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { 
        new: true, // Return the updated document
        upsert: true, // Create if doesn't exist
        runValidators: true // Run schema validators
      }
    );

    res.status(200).json({
      message: 'Hospital profile updated successfully',
      profile: updatedProfile
    });
  } catch (err) {
    console.error('Error updating hospital profile:', err);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};
const getMeterReadingTrend = async (req, res, next) => {
  try {
    const { userId, limit = 30 } = req.query;
    const trend = await MeterReading.find({ userId }).sort({ date: -1 }).limit(parseInt(limit));
    res.status(200).json(trend);
  } catch (err) {
    next(err);
  }
};

module.exports = {
    createIncident,
    getAllIncidents,
    updateIncident,
    deleteIncident,
    createAsset,
    getAllAssets,
    updateAsset,
    deleteAsset,
    createTask,
    getAllTasks,
    updateTask,
    deleteTask,
    createMeterReading,
    getAllMeterReadings,
    updateMeterReading,
    deleteMeterReading,
    createHospitalProfile,
    getHospitalProfile,
    updateHospitalProfile,
    getAllReports,
    getMeterReadingTrend,
};