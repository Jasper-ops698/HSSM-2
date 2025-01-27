const Request = require('../models/Request');
const Service = require('../models/Service');

exports.getDashboard = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let query = {};
    let populateOptions = [
      { path: 'service', model: 'Service' },
      { path: 'user', model: 'User' },
    ];

    // Role-based query adjustments
    if (req.user.role === 'service-provider') {
      query = { 'service.provider': req.user._id }; // Filter requests for service provider
    } else if (req.user.role === 'individual') {
      query = { user: req.user._id }; // Filter requests for individual user
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Apply filters from query parameters
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.serviceType) {
      query['service.name'] = { $regex: req.query.serviceType, $options: 'i' }; // Case-insensitive match for service name
    }
    if (req.query.startDate && req.query.endDate) {
      const startDate = new Date(req.query.startDate);
      const endDate = new Date(req.query.endDate);
      
      // Check if the dates are valid
      if (isNaN(startDate) || isNaN(endDate)) {
        return res.status(400).json({ message: 'Invalid date format' });
      }

      query.createdAt = {
        $gte: startDate, // Filter from start date
        $lte: endDate,   // Filter up to end date
      };
    }

    // Sorting options
    const sortOptions = {};
    if (req.query.sortBy) {
      const sortBy = req.query.sortBy;
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
      
      // Validate sortBy field (either 'date' or 'status')
      if (sortBy === 'date' || sortBy === 'status') {
        sortOptions[sortBy] = sortOrder;
      } else {
        return res.status(400).json({ message: 'Invalid sortBy value. Use "date" or "status".' });
      }
    }

    // Pagination validation
    const page = parseInt(req.query.page) || 1;  // Default to page 1 if not provided
    const limit = parseInt(req.query.limit) || 10;  // Default to 10 items per page
    const skip = (page - 1) * limit;

    // Fetching requests with filters, sorting, and pagination
    const requests = await Request.find(query)
      .populate(populateOptions)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const totalRequests = await Request.countDocuments(query);

    res.status(200).json({
      role: req.user.role,
      totalRequests,
      totalPages: Math.ceil(totalRequests / limit),
      currentPage: page,
      requests,
    });
  } catch (err) {
    console.error('Error fetching dashboard data:', err);  // Log the error for debugging
    res.status(500).json({ message: 'Error fetching dashboard data', error: err.message });
  }
};
