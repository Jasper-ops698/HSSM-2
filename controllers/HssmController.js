const { Incident, Asset, Task, MeterReading, Report } = require('../models/Hssm');

// Incident Controllers
exports.createIncident = async (req, res) => {
    try {
        const { department, title, priority, status, date } = req.body;
        const file = req.file ? req.file.filename : null;

        const newIncident = new Incident({
            department,
            title,
            priority,
            file,
            date, 
        });

        await newIncident.save();
        res.status(201).json(newIncident);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllIncidents = async (req, res) => {
    try {
        const incidents = await Incident.find();
        res.status(200).json(incidents);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Asset Controllers
exports.createAsset = async (req, res) => {
    try {
        const { name, serialNumber, category, location } = req.body;
        const file = req.file ? req.file.filename : null;

        const newAsset = new Asset({
            name,
            serialNumber,
            category,
            location,
            serviceRecords,
            file,
        });

        await newAsset.save();
        res.status(201).json(newAsset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllAssets = async (req, res) => {
    try {
        const assets = await Asset.find();
        res.status(200).json(assets);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Task Controllers
exports.createTask = async (req, res) => {
    try {
        const { task, assignedTo, dueDate, priority } = req.body;
        const file = req.file ? req.file.filename : null;

        const newTask = new Task({
            task,
            assignedTo,
            dueDate,
            priority,
            taskDescription,
            file,
        });

        await newTask.save();
        res.status(201).json(newTask);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllTasks = async (req, res) => {
    try {
        const tasks = await Task.find();
        res.status(200).json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Meter Reading Controllers
exports.createMeterReading = async (req, res) => {
    try {
      const { location, reading, date } = req.body;
  
      // Validate input fields
      if (!location || !reading || !date) {
        return res.status(400).json({ error: 'All fields are required: location, reading, and date.' });
      }
  
      // Check for an existing document or create a new one
      const updatedMeterReading = await MeterReading.findOneAndUpdate(
        {}, // Match any existing document
        { $push: { readings: { location, reading, date } } }, // Append the new reading
        { new: true, upsert: true } // Create a new document if none exists
      );
  
      res.status(201).json(updatedMeterReading); // Respond with the updated or newly created document
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  };

exports.getAllMeterReadings = async (req, res) => {
    try {
        const meterReadings = await MeterReading.find();
        res.status(200).json(meterReadings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Report Controllers
exports.createReport = async (req, res) => {
    try {
        const file = req.file ? req.file.filename : null;

        const newReport = new Report({
            file,
        });

        await newReport.save();
        res.status(201).json(newReport);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllReports = async (req, res) => {
    try {
        const reports = await Report.find();
        res.status(200).json(reports);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
