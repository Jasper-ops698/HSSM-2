const { Parser } = require('json2csv');
// @desc    Download department activity report as CSV
// @route   GET /api/admin/department-report-csv?department=DEPT&period=week|month&start=YYYY-MM-DD
// @access  Private/Admin
const downloadDepartmentReportCsv = async (req, res) => {
  try {
    const { department, period = 'week', start } = req.query;
    if (!department) {
      return res.status(400).json({ message: 'Department is required' });
    }
    // Calculate date range
  // Normalize start/end to UTC midnight boundaries to avoid timezone off-by-one errors
  let startDateInput = start ? new Date(start) : new Date();
  let startDate = new Date(Date.UTC(startDateInput.getUTCFullYear(), startDateInput.getUTCMonth(), startDateInput.getUTCDate()));
  let endDate = new Date(startDate);
    if (period === 'week') {
      endDate.setDate(startDate.getDate() + 7);
    } else if (period === 'month') {
      endDate.setMonth(startDate.getMonth() + 1);
    }
    // Fetch users in department
    const users = await User.find({ department }).select('name email role createdAt updatedAt');
    // Fetch activities (example: bookings, can add more models as needed)
    const bookings = await Booking.find({ department, createdAt: { $gte: startDate, $lt: endDate } }).select('student teacher className createdAt');

    // Fetch absences for this department and date range
    const Absence = require('../models/Absence');
    // Use UTC-based range: startDate inclusive to endDate exclusive
    const absences = await Absence.find({
      department,
      dateOfAbsence: { $gte: startDate, $lt: endDate }
    })
      .populate('teacher', 'name email role')
      .populate('student', 'name email role')
      .populate('class', 'name');

    // Fetch timetable entries (including archived) in the date range for this department
    const Timetable = require('../models/Timetable');
    const timetableEntries = await Timetable.find({
      department,
      // entries that overlap with the requested range
      $or: [
        { startDate: { $gte: startDate, $lt: endDate } },
        { endDate: { $gte: startDate, $lt: endDate } },
        { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
      ]
    }).populate('teacher', 'name email');

    // For each timetable entry, compute attendance summary by checking Attendance collection for the relevant dates
    const timetableRows = [];
    const Attendance = require('../models/Attendance');
    for (const entry of timetableEntries) {
      try {
        // Determine session date range intersection with requested date range
  // Determine intersection in UTC
  const sessionStart = entry.startDate && entry.startDate > startDate ? entry.startDate : startDate;
  const sessionEnd = entry.endDate && entry.endDate < endDate ? entry.endDate : endDate;

        // Count absences for this subject/teacher within the intersection dates
        // Count absences and presents using Attendance model
        // Normalize sessionStart/sessionEnd to UTC date boundaries for matching dateOfSession
        const utcSessionStart = new Date(Date.UTC(sessionStart.getUTCFullYear(), sessionStart.getUTCMonth(), sessionStart.getUTCDate()));
        const utcSessionEnd = new Date(Date.UTC(sessionEnd.getUTCFullYear(), sessionEnd.getUTCMonth(), sessionEnd.getUTCDate()));

        const attendanceDocs = await Attendance.find({
          department,
          class: entry.class || null,
          dateOfSession: { $gte: utcSessionStart, $lt: utcSessionEnd }
        }).select('status');

        let absentCount = 0, presentCount = 0, lateCount = 0, excusedCount = 0;
        attendanceDocs.forEach(a => {
          if (a.status === 'absent') absentCount++;
          else if (a.status === 'present') presentCount++;
          else if (a.status === 'late') lateCount++;
          else if (a.status === 'excused') excusedCount++;
        });

        // If no attendance docs, approximate enrolled count as before
        const ClassModel = require('../models/Class');
        let enrolledCount = 0;
        if (entry.subject) {
          const cls = await ClassModel.findOne({ name: entry.subject, department }).select('enrolledStudents');
          if (cls && cls.enrolledStudents) enrolledCount = cls.enrolledStudents.length;
        }

        // If we have attendance docs, use counts; otherwise approximate present via enrolledCount - absent
        if (attendanceDocs.length === 0) {
          presentCount = Math.max(0, enrolledCount - absentCount);
        }

        timetableRows.push({
          Type: 'TimetableEntry',
          Subject: entry.subject || '',
          Teacher: entry.teacher ? entry.teacher.name : '',
          StartDate: entry.startDate ? entry.startDate.toISOString().slice(0,10) : '',
          EndDate: entry.endDate ? entry.endDate.toISOString().slice(0,10) : '',
          DayOfWeek: entry.dayOfWeek || '',
          StartTime: entry.startTime || '',
          EndTime: entry.endTime || '',
          Archived: entry.archived ? 'Yes' : 'No',
          EnrolledStudents: enrolledCount,
          AbsentCount: absentCount,
          PresentCount: presentCount,
          LateCount: lateCount,
          ExcusedCount: excusedCount
        });
      } catch (e) {
        console.warn('Error computing timetable attendance for entry', entry._id, e.message || e);
      }
    }

    // Compose report rows
    const rows = [];
    users.forEach(user => {
      rows.push({
        Type: 'User',
        Name: user.name,
        Email: user.email,
        Role: user.role,
        Activity: 'Account',
        Date: user.createdAt.toISOString(),
        Details: 'User account created'
      });
    });
    bookings.forEach(b => {
      rows.push({
        Type: 'Booking',
        Name: b.student || '',
        Email: '',
        Role: 'student',
        Activity: 'Booking',
        Date: b.createdAt.toISOString(),
        Details: `Class: ${b.className}, Teacher: ${b.teacher}`
      });
    });
    absences.forEach(a => {
      rows.push({
        Type: 'Absence',
        Name: a.teacher ? a.teacher.name : (a.student ? a.student.name : ''),
        Email: a.teacher ? a.teacher.email : (a.student ? a.student.email : ''),
        Role: a.teacher ? a.teacher.role : (a.student ? a.student.role : ''),
        Activity: 'Absence',
        Date: a.dateOfAbsence ? a.dateOfAbsence.toISOString() : '',
        Details: `Reason: ${a.reason || ''}, Class: ${a.class && a.class.name ? a.class.name : ''}, Status: ${a.status}`
      });
    });
  // Append timetable rows to CSV rows
  timetableRows.forEach(r => rows.push(r));
    // Generate CSV
    const parser = new Parser();
    const csv = parser.parse(rows);
    res.header('Content-Type', 'text/csv');
    res.attachment(`${department}_activity_report_${period}_${startDate.toISOString().slice(0,10)}.csv`);
    return res.send(csv);
  } catch (error) {
    console.error('Error generating department report CSV:', error);
    res.status(500).json({ message: 'Error generating report', error: error.message });
  }
};
const User = require('../models/User');
const Booking = require('../models/Booking'); // Changed from Request
// const Service = require('../models/Service'); // Commented out for now
const { GeneratedReport, Incident, Asset, Task, MeterReading, Report } = require('../models/Hssm');
const bcrypt = require('bcryptjs');

// @desc    Admin assigns a role to a user
// @route   POST /api/admin/assignRole
// @access  Private/Admin
const assignUserRole = async (req, res) => {
  try {
    const { userId, role, department } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found.' });
    }

    // Basic validation for roles that might need a department
    if ((role === 'teacher' || role === 'HOD') && !department) {
      return res.status(400).json({ msg: 'Department is required for this role.' });
    }

    user.role = role;
    if (department) {
        user.department = department;
    }
    
    await user.save();
    res.status(200).json({ success: true, message: 'User role updated successfully.', user });
  } catch (error) {
    res.status(500).json({ msg: 'Error assigning role', error: error.message });
  }
};// Placeholder functions to prevent server crash

const addStaff = async (req, res) => {
  try {
    const { name, email, phone, password, department } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new staff member
    const newStaff = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'staff',
      department: department || '',
      emailVerified: true // Auto-verify staff created by admin
    });

    await newStaff.save();

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      staff: {
        _id: newStaff._id,
        name: newStaff.name,
        email: newStaff.email,
        role: newStaff.role,
        department: newStaff.department
      }
    });
  } catch (error) {
    console.error('Error creating staff member:', error);
    res.status(500).json({ message: 'Error creating staff member', error: error.message });
  }
};
const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    const staff = await User.findById(id);
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Staff member deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    res.status(500).json({ message: 'Error deleting staff member', error: error.message });
  }
};

const getAllData = async (req, res) => {
  try {
    // Fetch all data in parallel for efficiency
    const [users, bookings] = await Promise.all([
      User.find({}).select('id username email role isDisabled twoFactorEnabled').lean().catch(e => { throw new Error('User query failed: ' + e.message); }),
      Booking.find({}).lean().catch(e => { throw new Error('Booking query failed: ' + e.message); }),
    ]);

    // Process data to get analytics counts
    const userRoles = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    // Example: count bookings by department (customize as needed)
    const bookingDepartments = bookings.reduce((acc, booking) => {
      const dept = booking.department || 'Uncategorized';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});

    // Send the comprehensive data required by the frontend
    res.status(200).json({
      users,
      bookings,
      userRoles,
      bookingDepartments,
    });
  } catch (error) {
    console.error('Error fetching admin analytics data:', error);
    res.status(500).json({ msg: 'Error fetching data', error: error.message });
  }
};

const getAllReportsByHSSMProviders = async (req, res) => {
  try {
    // Find all HSSM-provider users
    const hssmProviders = await User.find({ role: 'HSSM-provider' }).select('_id name email');

    if (!hssmProviders || hssmProviders.length === 0) {
      return res.status(404).json({ message: 'No HSSM providers found' });
    }

    const providerIds = hssmProviders.map(provider => provider._id);

    // Fetch reports from different HSSM models
    const [generatedReports, incidents, assets, tasks, meterReadings, reports] = await Promise.all([
      GeneratedReport.find({ user: { $in: providerIds } }).populate('user', 'name email').sort({ createdAt: -1 }),
      Incident.find({ userId: { $in: providerIds } }).populate('userId', 'name email').sort({ date: -1 }),
      Asset.find({ userId: { $in: providerIds } }).populate('userId', 'name email').sort({ _id: -1 }),
      Task.find({ userId: { $in: providerIds } }).populate('userId', 'name email').sort({ dueDate: -1 }),
      MeterReading.find({ userId: { $in: providerIds } }).populate('userId', 'name email').sort({ date: -1 }),
      Report.find({}).sort({ _id: -1 }) // Reports don't have userId, so fetch all
    ]);

    // Structure the response
    const reportsData = {
      hssmProviders: hssmProviders,
      generatedReports: generatedReports,
      incidents: incidents,
      assets: assets,
      tasks: tasks,
      meterReadings: meterReadings,
      reports: reports,
      summary: {
        totalProviders: hssmProviders.length,
        totalGeneratedReports: generatedReports.length,
        totalIncidents: incidents.length,
        totalAssets: assets.length,
        totalTasks: tasks.length,
        totalMeterReadings: meterReadings.length,
        totalReports: reports.length
      }
    };

    res.status(200).json({
      success: true,
      message: 'Reports fetched successfully',
      data: reportsData
    });
  } catch (error) {
    console.error('Error fetching HSSM provider reports:', error);
    res.status(500).json({ message: 'Error fetching reports', error: error.message });
  }
};
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deletion of admin users
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin user' });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};;
const deleteHssmProviderReport = async (req, res) => {
  try {
    const { reportId, reportType } = req.params;

    let deletedReport;
    let modelName;

    // Delete based on report type
    switch (reportType) {
      case 'generated':
        deletedReport = await GeneratedReport.findByIdAndDelete(reportId);
        modelName = 'Generated Report';
        break;
      case 'incident':
        deletedReport = await Incident.findByIdAndDelete(reportId);
        modelName = 'Incident';
        break;
      case 'asset':
        deletedReport = await Asset.findByIdAndDelete(reportId);
        modelName = 'Asset';
        break;
      case 'task':
        deletedReport = await Task.findByIdAndDelete(reportId);
        modelName = 'Task';
        break;
      case 'meter':
        deletedReport = await MeterReading.findByIdAndDelete(reportId);
        modelName = 'Meter Reading';
        break;
      case 'report':
        deletedReport = await Report.findByIdAndDelete(reportId);
        modelName = 'Report';
        break;
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    if (!deletedReport) {
      return res.status(404).json({ message: `${modelName} not found` });
    }

    res.status(200).json({
      success: true,
      message: `${modelName} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting HSSM provider report:', error);
    res.status(500).json({ message: 'Error deleting report', error: error.message });
  }
};
const disableStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { disabled } = req.body; // true to disable, false to enable

    const staff = await User.findById(id);
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    staff.isDisabled = disabled;
    await staff.save();

    res.status(200).json({
      success: true,
      message: `Staff member ${disabled ? 'disabled' : 'enabled'} successfully`,
      staff: {
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        isDisabled: staff.isDisabled
      }
    });
  } catch (error) {
    console.error('Error updating staff member status:', error);
    res.status(500).json({ message: 'Error updating staff member status', error: error.message });
  }
};
const deleteHssmProvider = async (req, res) => {
  try {
    const { providerId } = req.params;

    const provider = await User.findById(providerId);
    if (!provider) {
      return res.status(404).json({ message: 'HSSM provider not found' });
    }

    // Delete all related data for this provider
    await Promise.all([
      GeneratedReport.deleteMany({ user: providerId }),
      Incident.deleteMany({ userId: providerId }),
      Asset.deleteMany({ userId: providerId }),
      Task.deleteMany({ userId: providerId }),
      MeterReading.deleteMany({ userId: providerId })
    ]);

    // Delete the provider user
    await User.findByIdAndDelete(providerId);

    res.status(200).json({
      success: true,
      message: 'HSSM provider and all related data deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting HSSM provider:', error);
    res.status(500).json({ message: 'Error deleting HSSM provider', error: error.message });
  }
};
const disableHssmProvider = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { disabled } = req.body; // true to disable, false to enable

    const provider = await User.findById(providerId);
    if (!provider) {
      return res.status(404).json({ message: 'HSSM provider not found' });
    }

    provider.isDisabled = disabled;
    await provider.save();

    res.status(200).json({
      success: true,
      message: `HSSM provider ${disabled ? 'disabled' : 'enabled'} successfully`,
      provider: {
        _id: provider._id,
        name: provider.name,
        email: provider.email,
        isDisabled: provider.isDisabled
      }
    });
  } catch (error) {
    console.error('Error updating HSSM provider status:', error);
    res.status(500).json({ message: 'Error updating HSSM provider status', error: error.message });
  }
};


module.exports = {
  assignUserRole,
  addStaff,
  deleteStaff,
  getAllData,
  getAllReportsByHSSMProviders,
  deleteUser,
  deleteHssmProviderReport,
  disableStaff,
  deleteHssmProvider,
  disableHssmProvider,
  downloadDepartmentReportCsv,
};