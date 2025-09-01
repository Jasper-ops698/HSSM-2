const User = require('../models/User');

// @desc    Get data for Credit Controller Dashboard (students and their credits)
// @route   GET /api/credit/dashboard
// @access  Private/Credit-Controller
const getDashboardData = async (req, res) => {
  try {
    // Fetch all students and their credit balances
    const students = await User.find({ role: 'student' }).select('name email credits');

    res.json({
      students,
    });
  } catch (error) {
    console.error('Error fetching Credit Controller dashboard data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add credits to a user's account
// @route   POST /api/credit/add
// @access  Private/Credit-Controller
const addCredits = async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Please provide a valid userId and a positive amount.' });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.credits = (user.credits || 0) + amount;
    await user.save();

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
// @access  Private/Credit-Controller
const deductCredits = async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Please provide a valid userId and a positive amount.' });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.credits < amount) {
      return res.status(400).json({ message: 'Insufficient credits.' });
    }

    user.credits -= amount;
    await user.save();

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


module.exports = {
  getDashboardData,
  addCredits,
  deductCredits,
};
