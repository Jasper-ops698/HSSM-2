const { HospitalLevel, Incident, Asset, Task, MeterReading, Report, HospitalProfile, GeneratedReport } = require('../models/Hssm');
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
    const { department, title, priority, description, date, userId } = req.body;
    const derivedUserId = req.user?.id || userId;
    if (!department || !title || !priority || !date || !derivedUserId) {
      return res.status(400).json({ message: 'Missing required fields: department, title, priority, date, userId' });
    }

    const file = req.file ? req.file.filename : null;
    const newIncident = new Incident({
      department: sanitizeInput(department),
      title: sanitizeInput(title),
      priority: sanitizeInput(priority),
      description: description ? sanitizeInput(description) : undefined,
      date: new Date(date),
      file,
      userId: derivedUserId,
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
    const { name, serialNumber, category, location, serviceRecords, userId } = req.body;
    const derivedUserId = req.user?.id || userId;
    if (!name || !serialNumber || !category || !location || !derivedUserId) {
      return res.status(400).json({ message: 'Missing required fields: name, serialNumber, category, location, userId' });
    }

    const file = req.file ? req.file.filename : null;
    const newAsset = new Asset({
      name: sanitizeInput(name),
      serialNumber: typeof serialNumber === 'string' ? sanitizeInput(serialNumber) : serialNumber,
      category: sanitizeInput(category),
      location: sanitizeInput(location),
      serviceRecords: serviceRecords ? sanitizeInput(serviceRecords) : undefined,
      file,
      userId: derivedUserId,
    });
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
    const {
      task,
      assignedTo,
      id,
      dueDate,
      priority = 'Medium',
      taskDescription,
      taskdescription,
      status,
      userId,
    } = req.body;
    const derivedUserId = req.user?.id || userId;
    if (!task || !assignedTo || !dueDate || !priority || !id || !derivedUserId) {
      return res.status(400).json({ message: 'Missing required fields: task, assignedTo, id, dueDate, priority, userId' });
    }

    const descriptionValue = taskDescription || taskdescription;
    const file = req.file ? req.file.filename : null;

    const newTask = new Task({
      task: sanitizeInput(task),
      assignedTo: sanitizeInput(assignedTo),
      id,
      dueDate: new Date(dueDate),
      priority: sanitizeInput(priority),
      status: status ? sanitizeInput(status) : undefined,
      taskDescription: descriptionValue ? sanitizeInput(descriptionValue) : undefined,
      file,
      userId: derivedUserId,
    });
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
    const { location, realPower_kW, apparentPower_kVA, date } = req.body;
    const userId = req.user.id;

    // --- Input Validation ---
    if (!location || !realPower_kW || !apparentPower_kVA || !date) {
      return res.status(400).json({ message: 'Missing required fields: location, Real Power (kW), Apparent Power (kVA), and date.' });
    }

    const realPower = parseFloat(realPower_kW);
    const apparentPower = parseFloat(apparentPower_kVA);

    if (isNaN(realPower) || isNaN(apparentPower)) {
        return res.status(400).json({ message: 'Real Power and Apparent Power must be valid numbers.' });
    }
    if (apparentPower <= 0) {
        return res.status(400).json({ message: 'Apparent Power (kVA) must be greater than zero.' });
    }
    if (realPower > apparentPower) {
        return res.status(400).json({ message: 'Real Power (kW) cannot be greater than Apparent Power (kVA).' });
    }
    if (realPower < 0 || apparentPower < 0) {
        return res.status(400).json({ message: 'Power values cannot be negative.' });
    }

    // --- Power Factor Calculation ---
    const rawPowerFactor = realPower / apparentPower;
    const powerFactor = Math.min(1, Math.max(0, Number(rawPowerFactor.toFixed(4))));

    const newReading = new MeterReading({
      location: sanitizeInput(location),
      realPower_kW: realPower,
      apparentPower_kVA: apparentPower,
      powerFactor,
      date: new Date(date),
      userId
    });

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

const updateIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Sanitize string inputs
    if (updateData.department) updateData.department = sanitizeInput(updateData.department);
    if (updateData.title) updateData.title = sanitizeInput(updateData.title);
    if (updateData.priority) updateData.priority = sanitizeInput(updateData.priority);
    if (updateData.description) updateData.description = sanitizeInput(updateData.description);
    
    // Handle file upload
    if (req.file) {
      updateData.file = req.file.filename;
    }
    
    const updatedIncident = await Incident.findByIdAndUpdate(id, updateData, { new: true });
    if (!updatedIncident) {
      return res.status(404).json({ message: 'Incident not found' });
    }
    res.status(200).json(updatedIncident);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedIncident = await Incident.findByIdAndDelete(id);
    if (!deletedIncident) {
      return res.status(404).json({ message: 'Incident not found' });
    }
    res.status(200).json({ message: 'Incident deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Handle file upload
    if (req.file) {
      updateData.file = req.file.filename;
    }
    
    const updatedAsset = await Asset.findByIdAndUpdate(id, updateData, { new: true });
    if (!updatedAsset) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    res.status(200).json(updatedAsset);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedAsset = await Asset.findByIdAndDelete(id);
    if (!deletedAsset) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    res.status(200).json({ message: 'Asset deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Sanitize string inputs
    if (updateData.title) updateData.title = sanitizeInput(updateData.title);
    if (updateData.description) updateData.description = sanitizeInput(updateData.description);
    if (updateData.assignedTo) updateData.assignedTo = sanitizeInput(updateData.assignedTo);
    if (updateData.priority) updateData.priority = sanitizeInput(updateData.priority);
    
    const updatedTask = await Task.findByIdAndUpdate(id, updateData, { new: true });
    if (!updatedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.status(200).json(updatedTask);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTask = await Task.findByIdAndDelete(id);
    if (!deletedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateMeterReading = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const updatedReading = await MeterReading.findByIdAndUpdate(id, updateData, { new: true });
    if (!updatedReading) {
      return res.status(404).json({ message: 'Meter reading not found' });
    }
    res.status(200).json(updatedReading);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteMeterReading = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedReading = await MeterReading.findByIdAndDelete(id);
    if (!deletedReading) {
      return res.status(404).json({ message: 'Meter reading not found' });
    }
    res.status(200).json({ message: 'Meter reading deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const createHospitalProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profileData = { ...req.body, userId };
    
    // Sanitize string inputs
    if (profileData.hospitalName) profileData.hospitalName = sanitizeInput(profileData.hospitalName);
    if (profileData.mission) profileData.mission = sanitizeInput(profileData.mission);
    if (profileData.vision) profileData.vision = sanitizeInput(profileData.vision);
    if (profileData.serviceCharter) profileData.serviceCharter = sanitizeInput(profileData.serviceCharter);
    
    // Handle location subfields sanitization
    if (profileData.location) {
      if (profileData.location.address) profileData.location.address = sanitizeInput(profileData.location.address);
      if (profileData.location.city) profileData.location.city = sanitizeInput(profileData.location.city);
      if (profileData.location.state) profileData.location.state = sanitizeInput(profileData.location.state);
      if (profileData.location.country) profileData.location.country = sanitizeInput(profileData.location.country);
      if (profileData.location.postalCode) profileData.location.postalCode = sanitizeInput(profileData.location.postalCode);
    }
    
    // Handle file upload for organogram
    if (req.file) {
      profileData.organogram = req.file.filename;
    }
    
    const newProfile = new HospitalProfile(profileData);
    await newProfile.save();
    res.status(201).json(newProfile);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ message: 'Hospital profile already exists for this user' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
};
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

const getAllReports = async (req, res) => {
  try {
    const reports = await GeneratedReport.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Server error while fetching reports' });
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

const shareHospitalProfile = async (req, res) => {
  try {
    const { email, message, profileData } = req.body;
    const userId = req.user.id;

    // Here you would typically integrate with an email service like SendGrid, Nodemailer, etc.
    // For now, we'll just log the share request and return success
    console.log('Profile share request:', {
      from: userId,
      to: email,
      message: message,
      profileData: profileData
    });

    // TODO: Implement actual email sending
    // Example with nodemailer:
    // const transporter = nodemailer.createTransporter({...});
    // await transporter.sendMail({
    //   from: 'noreply@hospital.com',
    //   to: email,
    //   subject: 'Hospital Profile Shared',
    //   html: `<p>${message}</p><pre>${JSON.stringify(profileData, null, 2)}</pre>`
    // });

    res.status(200).json({
      message: 'Profile shared successfully',
      sharedWith: email
    });
  } catch (error) {
    console.error('Error sharing profile:', error);
    res.status(500).json({ message: 'Failed to share profile' });
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
    shareHospitalProfile,
    getAllReports,
    getMeterReadingTrend,
};