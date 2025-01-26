const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

// Define schemas
const incidentSchema = new mongoose.Schema({
    department: { type: String, required: true }, // Department associated with the incident
    title: { type: String, required: true }, // Title of the incident
    description: { type: String }, // Detailed description of the incident
    priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true }, // Priority level
    date: { type: Date, required: true }, // Date of the incident
    file: { type: String }, // File attachment (optional)
});

const assetSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Name of the asset
    serialNumber: { type: mongoose.Schema.Types.Mixed, required: true }, // Serial number of the asset (can be string or number)
    category: { type: String, enum: ['Fixed Assets', 'Consumables'], default: 'Fixed Assets' }, // Category
    location: { type: String, required: true }, // Location of the asset
    'service records': { type: String }, // Service records (optional)
    file: { type: String }, // File attachment (optional)
});

const taskSchema = new mongoose.Schema({
    task: { type: String, required: true }, // Task title or description
    assignedTo: { type: String, required: true }, // Person assigned to the task
    dueDate: { type: Date, required: true }, // Due date for the task
    priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true }, // Priority level
    'task description': { type: String }, // Task status or description
    file: { type: String }, // File attachment (optional)
});

const meterReadingSchema = new mongoose.Schema({
    readings: [
      {
        location: { type: String, required: true },
        reading: { type: Number, required: true },
        date: { type: Date, required: true },
      },
    ],
  });

const reportSchema = new mongoose.Schema({
    file: { type: String, required: true }, // File attachment for the report
});

// Models
const Incident = mongoose.model('Incident', incidentSchema);
const Asset = mongoose.model('Asset', assetSchema);
const Task = mongoose.model('Task', taskSchema);
const MeterReading = mongoose.model('MeterReading', meterReadingSchema);
const Report = mongoose.model('Report', reportSchema);

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

module.exports = { Incident, Asset, Task, MeterReading, Report, upload };
