const User = require('../models/User');

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
};

// Placeholder functions to prevent server crash

const addServiceProvider = (req, res) => res.status(501).json({ message: 'Not Implemented' });
const deleteServiceProvider = (req, res) => res.status(501).json({ message: 'Not Implemented' });
const getAllData = async (req, res) => {
  try {
    const users = await User.find({}, 'name email role department'); // Fetch users with selected fields
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ msg: 'Error fetching data', error: error.message });
  }
};
const getAllReportsByHSSMProviders = (req, res) => res.status(501).json({ message: 'Not Implemented' });
const deleteUser = (req, res) => res.status(501).json({ message: 'Not Implemented' });
const deleteHssmProviderReport = (req, res) => res.status(501).json({ message: 'Not Implemented' });
const disableServiceProvider = (req, res) => res.status(501).json({ message: 'Not Implemented' });
const deleteHssmProvider = (req, res) => res.status(501).json({ message: 'Not Implemented' });
const disableHssmProvider = (req, res) => res.status(501).json({ message: 'Not Implemented' });


module.exports = {
  assignUserRole,
  addServiceProvider,
  deleteServiceProvider,
  getAllData,
  getAllReportsByHSSMProviders,
  deleteUser,
  deleteHssmProviderReport,
  disableServiceProvider,
  deleteHssmProvider,
  disableHssmProvider,
};