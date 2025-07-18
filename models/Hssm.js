const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

// Define hospitalLevels schema
const hospitalLevelSchema = new mongoose.Schema({
    level: { type: Number, required: true, min: 1, max: 6, unique: true },
    services: { type: [String], required: true },
    requirements: { type: Object }
});

// Define incident schema
const incidentSchema = new mongoose.Schema({
    department: { type: String, required: true }, // Department associated with the incident
    title: { type: String, required: true }, // Title of the incident
    description: { type: String }, // Detailed description of the incident
    priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true }, // Priority level
    date: { type: Date, required: true }, // Date of the incident
    file: { type: String }, // File attachment (optional)
});

// Define asset schema
const assetSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Name of the asset
    serialNumber: { type: mongoose.Schema.Types.Mixed, required: true }, // Serial number of the asset (can be string or number)
    category: { type: String, enum: ['Fixed Assets', 'Consumables', 'Other'], required: true }, // Category with added 'Other'
    location: { type: String, required: true }, // Location of the asset
    serviceRecords: { type: String }, // Service records (optional), renamed from 'service records'
    file: { type: String }, // File attachment (optional)
});

// Define task schema
const taskSchema = new mongoose.Schema({
    task: { type: String, required: true }, // Task title or description
    assignedTo: { type: String, required: true }, // Person assigned to the task
    id: { type: mongoose.Schema.Types.Mixed, required: true }, // ID as either a number or string
    dueDate: { type: Date, required: true }, // Due date for the task
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' }, // Priority level with default
    taskDescription: { type: String }, // Task description, renamed from 'task description'
    file: { type: String }, // File attachment (optional)
});

// Define meterReading schema with flattened structure and userId
const meterReadingSchema = new mongoose.Schema({
    location: { type: String, required: true },
    reading: { type: Number, required: true },
    date: { type: Date, required: true },
    userId: { type: String, required: true }
});

// Define report schema
const reportSchema = new mongoose.Schema({
    file: { type: String, required: true }, // File attachment for the report
});

// Define hospitalProfile schema for mission, vision, and service charter
const hospitalProfileSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    hospitalName: { type: String, default: '' },
    establishedDate: { type: Date },
    location: {
        address: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        country: { type: String, default: '' },
        postalCode: { type: String, default: '' }
    },
    mission: { type: String, default: '' },
    vision: { type: String, default: '' },
    serviceCharter: { type: String, default: '' },
    organogram: { type: String }, // Will store the file path
    technicalPlans: [{ 
        title: { type: String, required: true },
        description: { type: String },
        fileUrl: { type: String, required: true },
        uploadDate: { type: Date, default: Date.now },
        fileType: { type: String }
    }]
});

// Models
const HospitalLevel = mongoose.model('HospitalLevel', hospitalLevelSchema);
const Incident = mongoose.model('Incident', incidentSchema);
const Asset = mongoose.model('Asset', assetSchema);
const Task = mongoose.model('Task', taskSchema);
const MeterReading = mongoose.model('MeterReading', meterReadingSchema);
const Report = mongoose.model('Report', reportSchema);
const HospitalProfile = mongoose.model('HospitalProfile', hospitalProfileSchema);

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

module.exports = { HospitalLevel, Incident, Asset, Task, MeterReading, Report, HospitalProfile, upload };
