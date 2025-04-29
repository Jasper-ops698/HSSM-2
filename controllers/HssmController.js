const { HospitalLevel, Incident, Asset, Task, MeterReading, Report, HospitalProfile } = require('../models/Hssm');
const sanitizeHtml = require('sanitize-html');

// Helper function to sanitize input
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return sanitizeHtml(input);
  }
  return input;
};

// HospitalLevel Controllers
exports.getServicesByLevel = async (req, res, next) => {
  try {
    const level = parseInt(req.params.level, 10);
    if (isNaN(level) || level < 1 || level > 6) {
      return res.status(400).json({ message: 'Invalid hospital level. Must be between 1 and 6.' });
    }
    const hospitalLevel = await HospitalLevel.findOne({ level });
    if (!hospitalLevel) {
      return res.status(404).json({ message: 'Hospital level not found' });
    }
    res.status(200).json(hospitalLevel.services);
  } catch (error) {
    next(error);
  }
};

// Incident Controllers
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

// Asset Controllers
const isAssetCompatibleWithFacility = (assetCategory, facilityLevel) => {
  if (assetCategory === 'Fixed Assets') return true;
  if (assetCategory === 'Consumables' && facilityLevel <= 4) return true;
  if (assetCategory === 'Other' && facilityLevel >= 5) return true;
  return false;
};

exports.createAsset = async (req, res, next) => {
  try {
    const { name, serialNumber, category, location, serviceRecords, facilityLevel } = req.body;
    const file = req.file ? req.file.filename : null;

    if (!name || !serialNumber || !category || !location || !facilityLevel) {
      return res.status(400).json({ message: 'Missing required fields: name, serialNumber, category, location, facilityLevel' });
    }

    const allowedCategories = ['Fixed Assets', 'Consumables', 'Other'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ message: `Invalid category. Allowed categories: ${allowedCategories.join(', ')}` });
    }

    const facilityLevelNum = parseInt(facilityLevel, 10);
    if (!isAssetCompatibleWithFacility(category, facilityLevelNum)) {
      return res.status(400).json({ message: 'Asset category not compatible with facility level' });
    }

    const newAsset = new Asset({
      name: sanitizeInput(name),
      serialNumber: sanitizeInput(serialNumber),
      category: sanitizeInput(category),
      location: sanitizeInput(location),
      serviceRecords: sanitizeInput(serviceRecords),
      file,
    });

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

// Task Controllers
exports.createTask = async (req, res, next) => {
  try {
    const { task, assignedTo, id, dueDate, priority, taskDescription } = req.body;
    const file = req.file ? req.file.filename : null;

    if (!task || !assignedTo || !id || !dueDate) {
      return res.status(400).json({ message: 'Missing required fields: task, assignedTo, id, dueDate' });
    }

    const allowedPriorities = ['Low', 'Medium', 'High'];
    const taskPriority = priority && allowedPriorities.includes(priority) ? priority : 'Medium';

    const newTask = new Task({
      task: sanitizeInput(task),
      assignedTo: sanitizeInput(assignedTo),
      id: sanitizeInput(id),
      dueDate: new Date(dueDate),
      priority: taskPriority,
      taskDescription: sanitizeInput(taskDescription),
      file,
    });

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

// Meter Reading Controllers
exports.createMeterReading = async (req, res, next) => {
  try {
    const { location, reading, date } = req.body;
    const userId = req.user ? req.user._id.toString() : null;

    if (!location || !reading || !date) {
      return res.status(400).json({ message: 'Missing required fields: location, reading, date' });
    }
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const newMeterReading = new MeterReading({
      location: sanitizeInput(location),
      reading: Number(reading),
      date: new Date(date),
      userId,
    });

    await newMeterReading.save();
    res.status(201).json(newMeterReading);
  } catch (err) {
    next(err);
  }
};

exports.getAllMeterReadings = async (req, res, next) => {
  try {
    const meterReadings = await MeterReading.find();
    res.status(200).json(meterReadings);
  } catch (err) {
    next(err);
  }
};

// Meter Reading Trend Controller
exports.getMeterReadingTrend = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id.toString() : null;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    const limit = parseInt(req.query.limit, 10) || 30;
    const meterReadings = await MeterReading.find({ userId })
      .sort({ date: -1 })
      .limit(limit);
    res.status(200).json(meterReadings.reverse()); // Return in ascending order by date
  } catch (err) {
    next(err);
  }
};

// Hospital Profile Controllers
exports.getHospitalProfile = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id.toString() : null;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    let profile = await HospitalProfile.findOne({ userId });
    if (!profile) {
      profile = new HospitalProfile({ userId });
      await profile.save();
    }
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

exports.updateHospitalProfile = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id.toString() : null;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const { 
      hospitalName, 
      establishedDate, 
      location, 
      mission, 
      vision, 
      serviceCharter 
    } = req.body;

    const updateData = {
      hospitalName: sanitizeInput(hospitalName),
      establishedDate: establishedDate ? new Date(establishedDate) : undefined,
      location: location ? {
        address: sanitizeInput(location.address),
        city: sanitizeInput(location.city),
        state: sanitizeInput(location.state),
        country: sanitizeInput(location.country),
        postalCode: sanitizeInput(location.postalCode)
      } : undefined,
      mission: sanitizeInput(mission),
      vision: sanitizeInput(vision),
      serviceCharter: sanitizeInput(serviceCharter)
    };

    // If there's an organogram file
    if (req.files?.organogram) {
      updateData.organogram = req.files.organogram[0].filename;
    }

    let profile = await HospitalProfile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true }
    );
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

exports.uploadTechnicalPlan = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id.toString() : null;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'Title is required for technical plan' });
    }

    const technicalPlan = {
      title: sanitizeInput(title),
      description: sanitizeInput(description),
      fileUrl: req.file.filename,
      fileType: req.file.mimetype
    };

    const profile = await HospitalProfile.findOneAndUpdate(
      { userId },
      { $push: { technicalPlans: technicalPlan } },
      { new: true, upsert: true }
    );

    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

exports.deleteTechnicalPlan = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id.toString() : null;
    const { planId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const profile = await HospitalProfile.findOneAndUpdate(
      { userId },
      { $pull: { technicalPlans: { _id: planId } } },
      { new: true }
    );

    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

// Report Generation Controller
exports.generateReport = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id.toString() : null;
    const { startDate, endDate } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Missing required fields: startDate, endDate' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    const assets = await Asset.find({});
    const incidents = await Incident.find({});
    const tasks = await Task.find({});
    const meterReadings = await MeterReading.find({ userId, date: { $gte: start, $lte: end } });
    const profile = await HospitalProfile.findOne({ userId });

    const report = `
      Technical Report for User ID: ${userId}
      Date Range: ${startDate} to ${endDate}

      Mission: ${profile?.mission || 'Not set'}
      Vision: ${profile?.vision || 'Not set'}
      Service Charter: ${profile?.serviceCharter || 'Not set'}

      Assets Count: ${assets.length}
      Incidents Count: ${incidents.length}
      Tasks Count: ${tasks.length}
      Meter Readings Count: ${meterReadings.length}

      Detailed Meter Readings:
      ${meterReadings.map(mr => `Location: ${mr.location}, Reading: ${mr.reading}, Date: ${mr.date.toISOString()}`).join('\n')}
    `;

    res.status(200).json({ report });
  } catch (err) {
    next(err);
  }
};

// Report Controllers
exports.getAllReports = async (req, res, next) => {
  try {
    const userId = req.query.userId || (req.user ? req.user._id.toString() : null);
    // If you want to filter by user, uncomment the next line
    // const query = userId ? { userId } : {};
    // For now, fetch all reports
    const reports = await Report.find(userId ? { userId } : {});
    res.status(200).json(reports);
  } catch (err) {
    next(err);
  }
};
