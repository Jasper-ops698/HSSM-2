const Request = require('../models/Request'); // Assuming there's a Request model
const User = require('../models/User');

// Create a new request
exports.createRequest = async (req, res) => {
  try {
    const { title, description, type, priority } = req.body;
    const userId = req.user._id;

    const request = new Request({
      title,
      description,
      type,
      priority: priority || 'medium',
      createdBy: userId,
      status: 'pending'
    });

    await request.save();

    res.status(201).json({
      success: true,
      message: 'Request created successfully',
      request
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating request'
    });
  }
};

// Get user's requests
exports.getUserRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = {};

    // If not admin, only show user's own requests
    if (userRole !== 'admin') {
      query.createdBy = userId;
    }

    const requests = await Request.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching requests'
    });
  }
};

// Update request status
exports.updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, response } = req.body;
    const userId = req.user._id;

    const request = await Request.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check if user owns the request or is admin
    if (request.createdBy.toString() !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this request'
      });
    }

    request.status = status;
    if (response) {
      request.response = response;
    }

    await request.save();

    res.status(200).json({
      success: true,
      message: 'Request updated successfully',
      request
    });
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating request'
    });
  }
};

module.exports = {
  createRequest: exports.createRequest,
  getUserRequests: exports.getUserRequests,
  updateRequestStatus: exports.updateRequestStatus,
};