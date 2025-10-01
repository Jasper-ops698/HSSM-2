const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const Notification = require('./Notification'); // Import Notification model
const User = require('./User'); // Import User model

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
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link incident to a user/facility
});

// Post-save hook to create notifications for high-priority incidents
incidentSchema.post('save', async function (doc, next) {
    // We only trigger on creation of a new document, not on update
    if (this.isNew && doc.priority === 'High') {
        try {
            // Find all users with the 'HSSM-provider' role.
            // In a more complex app, you might find a provider linked to the incident's user/facility.
            const hssmProviders = await User.find({ role: 'HSSM-provider' });

            if (hssmProviders.length > 0) {
                const notifications = hssmProviders.map(provider => ({
                    recipient: provider._id,
                    type: 'incident',
                    title: 'High Priority Incident',
                    message: `New high-priority incident logged: "${doc.title}"`,
                    data: { incidentId: doc._id, priority: doc.priority, department: doc.department }
                }));
                await Notification.insertMany(notifications);
            }
        } catch (error) {
            console.error('Error creating notification for high-priority incident:', error);
            // We don't want to fail the main operation, so we just log the error.
        }
    }
    next();
});

// Define task schema
const taskSchema = new mongoose.Schema({
    task: { type: String, required: true }, // Task title or description
    assignedTo: { type: String, required: true }, // Person assigned to the task
    id: { type: mongoose.Schema.Types.Mixed, required: true }, // ID as either a number or string
    dueDate: { type: Date, required: true }, // Due date for the task
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' }, // Priority level with default
    status: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Overdue'], default: 'Pending' }, // Task status
    taskDescription: { type: String }, // Task description, renamed from 'task description'
    file: { type: String }, // File attachment (optional)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

// Post-save hook to create notifications for overdue tasks
taskSchema.post('save', async function (doc, next) {
    // Check if task is overdue and not completed
    if (doc.dueDate < new Date() && doc.status !== 'Completed') {
        try {
            // Find all users with the 'HSSM-provider' role
            const hssmProviders = await User.find({ role: 'HSSM-provider' });

            if (hssmProviders.length > 0) {
                // Check if notification already exists for this task
                const existingNotification = await Notification.findOne({
                    type: 'overdue_task',
                    'data.taskId': doc._id,
                    read: false
                });

                if (!existingNotification) {
                    const notifications = hssmProviders.map(provider => ({
                        recipient: provider._id,
                        type: 'overdue_task',
                        title: 'Overdue Task',
                        message: `Task "${doc.task}" is overdue. Due date: ${doc.dueDate.toLocaleDateString()}`,
                        data: { taskId: doc._id, dueDate: doc.dueDate, priority: doc.priority }
                    }));
                    await Notification.insertMany(notifications);
                }
            }
        } catch (error) {
            console.error('Error creating notification for overdue task:', error);
        }
    }
    next();
});

// NOTE: To implement notifications for tasks nearing their due date,
// a scheduled job (using a library like node-cron) would be required to run periodically (e.g., daily)
// and check for tasks with upcoming deadlines. This is a good future enhancement.

// Define asset schema
const assetSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Name of the asset
    serialNumber: { type: mongoose.Schema.Types.Mixed, required: true }, // Serial number of the asset (can be string or number)
    category: { type: String, enum: ['Fixed Assets', 'Consumables', 'Other'], required: true }, // Category with added 'Other'
    location: { type: String, required: true }, // Location of the asset
    serviceRecords: { type: String }, // Service records (optional), renamed from 'service records'
    file: { type: String }, // File attachment (optional)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

// Define meterReading schema for power factor calculation
const meterReadingSchema = new mongoose.Schema({
    location: { type: String, required: true },
    realPower_kW: { type: Number, required: true }, // Real Power in kilowatts
    apparentPower_kVA: { type: Number, required: true }, // Apparent Power in kilovolt-amperes
    powerFactor: { type: Number, required: true, min: 0, max: 1 }, // Calculated power factor
    date: { type: Date, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
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

const GeneratedReportSchema = new mongoose.Schema({
    title: { type: String, required: true },
    markdownContent: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: ['pending', 'generating', 'completed', 'failed'],
        default: 'pending',
    },
    error: { type: String }, // To store any error messages
}, { timestamps: true });

const GeneratedReport = mongoose.model('GeneratedReport', GeneratedReportSchema);


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

module.exports = {
    HospitalLevel,
    Incident,
    Asset,
    Task,
    MeterReading,
    Report,
    HospitalProfile,
    GeneratedReport,
    upload,
};
