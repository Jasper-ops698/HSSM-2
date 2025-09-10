const User = require('../models/User');
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
    if (!staff || staff.role !== 'staff') {
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
    const users = await User.find({}, 'name email role department'); // Fetch users with selected fields
    res.status(200).json({ users });
  } catch (error) {
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
    if (!staff || staff.role !== 'staff') {
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
    if (!provider || provider.role !== 'HSSM-provider') {
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
    if (!provider || provider.role !== 'HSSM-provider') {
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
};