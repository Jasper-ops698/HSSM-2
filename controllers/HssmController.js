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
exports.createIncident = async (req, res, next) => {
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

exports.getAllIncidents = async (req, res, next) => {
  try {
    const incidents = await Incident.find();
    res.status(200).json(incidents);
  } catch (err) {
    next(err);
  }
};

// --- Asset Controllers ---
exports.createAsset = async (req, res, next) => {
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

exports.getAllAssets = async (req, res, next) => {
  try {
    const assets = await Asset.find();
    res.status(200).json(assets);
  } catch (err) {
    next(err);
  }
};

// --- Task Controllers ---
exports.createTask = async (req, res, next) => {
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

exports.getAllTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find();
    res.status(200).json(tasks);
  } catch (err) {
    next(err);
  }
};

// --- Meter Reading Controllers ---
exports.createMeterReading = async (req, res, next) => {
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

exports.getAllMeterReadings = async (req, res, next) => {
  try {
    const readings = await MeterReading.find();
    res.status(200).json(readings);
  } catch (err) {
    next(err);
  }
};


// --- ADDED PLACEHOLDER FUNCTIONS ---

exports.updateIncident = (req, res) => res.status(501).json({ message: 'Not Implemented' });
exports.deleteIncident = (req, res) => res.status(501).json({ message: 'Not Implemented' });

exports.updateAsset = (req, res) => res.status(501).json({ message: 'Not Implemented' });
exports.deleteAsset = (req, res) => res.status(501).json({ message: 'Not Implemented' });

exports.updateTask = (req, res) => res.status(501).json({ message: 'Not Implemented' });
exports.deleteTask = (req, res) => res.status(501).json({ message: 'Not Implemented' });

exports.updateMeterReading = (req, res) => res.status(501).json({ message: 'Not Implemented' });
exports.deleteMeterReading = (req, res) => res.status(501).json({ message: 'Not Implemented' });

exports.createHospitalProfile = (req, res) => res.status(501).json({ message: 'Not Implemented' });
exports.getHospitalProfile = (req, res) => res.status(501).json({ message: 'Not Implemented' });
exports.updateHospitalProfile = (req, res) => res.status(501).json({ message: 'Not Implemented' });