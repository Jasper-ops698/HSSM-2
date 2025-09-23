const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const NotificationService = require('../services/notificationService');
const { getIO } = require('../src/socket');

// @desc    Get data for Credit Controller Dashboard (students and their credits)
// @route   GET /api/credit/dashboard
// @access  Private/Credit-Controller/Admin/Teacher
const getDashboardData = async (req, res) => {
  try {
    // Fetch all students and their credit balances
    const students = await User.find({ role: 'student' }).select('name email credits');

    // Calculate today's credit actions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const actionsToday = await CreditTransaction.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    res.json({
      students,
      actionsToday,
      totalCreditsRemitted: students.reduce((total, student) => total + (student.credits || 0), 0)
    });
  } catch (error) {
    console.error('Error fetching Credit Controller dashboard data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add credits to a user's account
// @route   POST /api/credit/add
// @access  Private/Credit-Controller/Admin/Teacher
const addCredits = async (req, res) => {
  const { userId, amount, reason = 'Manual credit addition' } = req.body;

  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Please provide a valid userId and a positive amount.' });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const previousBalance = user.credits || 0;
    user.credits = previousBalance + amount;
    await user.save();

    // Log the transaction
    await CreditTransaction.create({
      user: userId,
      action: 'add',
      amount: amount,
      previousBalance: previousBalance,
      newBalance: user.credits,
      reason: reason,
      performedBy: req.user._id, // Correct field for schema
      transactionType: 'manual'
    });

    // Send notification to the user
    await NotificationService.sendCreditNotification(userId, amount, 'add');

    // Emit socket event to notify user's connected clients about credit update
    try {
      const io = getIO();
      const payload = { userId: String(user._id), credits: user.credits, amount, action: 'add' };
      io.to(`user:${String(user._id)}`).emit('credit_updated', payload);
    } catch (emitErr) {
      console.warn('Failed to emit credit_updated socket event:', emitErr.message || emitErr);
    }

    res.json({
      message: `Successfully added ${amount} credits. New balance is ${user.credits}.`,
      user: {
        id: user._id,
        name: user.name,
        credits: user.credits,
      },
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Deduct credits from a user's account
// @route   POST /api/credit/deduct
// @access  Private/Credit-Controller/Admin/Teacher
const deductCredits = async (req, res) => {
  const { userId, amount, reason = 'Manual credit deduction' } = req.body;

  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Please provide a valid userId and a positive amount.' });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const previousBalance = user.credits || 0;

    if (previousBalance < amount) {
      return res.status(400).json({ message: 'Insufficient credits. Cannot deduct more than available balance.' });
    }

    user.credits = previousBalance - amount;
    await user.save();

    // Log the transaction
    await CreditTransaction.create({
      user: userId,
      action: 'deduct',
      amount: amount,
      previousBalance: previousBalance,
      newBalance: user.credits,
      reason: reason,
      performedBy: req.user._id,
      transactionType: 'manual'
    });

    // Send notification to the user
    await NotificationService.sendCreditNotification(userId, amount, 'deduct');

    // Emit socket event to notify user's connected clients about credit update
    try {
      const io = getIO();
      const payload = { userId: String(user._id), credits: user.credits, amount, action: 'deduct' };
      io.to(`user:${String(user._id)}`).emit('credit_updated', payload);
    } catch (emitErr) {
      console.warn('Failed to emit credit_updated socket event:', emitErr.message || emitErr);
    }

    res.json({
      message: `Successfully deducted ${amount} credits. New balance is ${user.credits}.`,
      user: {
        id: user._id,
        name: user.name,
        credits: user.credits,
      },
    });
  } catch (error) {
    console.error('Error deducting credits:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get credit transaction history
// @route   GET /api/credit/transactions
// @access  Private/Credit-Controller/Admin/Teacher
const getTransactionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, userId, action, startDate, endDate } = req.query;

    let query = {};

    // Filter by user if specified
    if (userId) {
      query.user = userId;
    }

    // Filter by action if specified
    if (action) {
      query.action = action;
    }

    // Filter by date range if specified
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const transactions = await CreditTransaction.find(query)
      .populate('user', 'name email')
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CreditTransaction.countDocuments(query);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


module.exports = {
  getDashboardData,
  addCredits,
  deductCredits,
  getTransactionHistory,
};
