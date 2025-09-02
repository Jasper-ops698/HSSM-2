const Class = require('../models/Class');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');

// @desc    Create a new class
// @route   POST /api/classes
// @access  Private (Admin, HOD)
const createClass = async (req, res) => {
  try {
    const { name, description, teacherId } = req.body;

    if (!name || !description) {
      return res.status(400).json({ success: false, message: 'Please provide name and description.' });
    }

    const newClass = new Class({
      name,
      description,
      teacher: teacherId, // Optional: assign a teacher on creation
    });

    const savedClass = await newClass.save();
    res.status(201).json({ success: true, data: savedClass });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Get all classes
// @route   GET /api/classes
// @access  Private
const getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find().populate('teacher', 'name email');
    res.status(200).json({ success: true, data: classes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Update a class
// @route   PUT /api/classes/:id
// @access  Private (Admin, HOD)
const updateClass = async (req, res) => {
  try {
    const { name, description, teacherId } = req.body;
    const classToUpdate = await Class.findById(req.params.id);

    if (!classToUpdate) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    classToUpdate.name = name || classToUpdate.name;
    classToUpdate.description = description || classToUpdate.description;
    if (teacherId) {
        classToUpdate.teacher = teacherId;
    }

    const updatedClass = await classToUpdate.save();
    res.status(200).json({ success: true, data: updatedClass });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Delete a class
// @route   DELETE /api/classes/:id
// @access  Private (Admin, HOD)
const deleteClass = async (req, res) => {
  try {
    const classToDelete = await Class.findById(req.params.id);

    if (!classToDelete) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    await classToDelete.deleteOne();
    res.status(200).json({ success: true, message: 'Class deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Get classes by teacher
// @route   GET /api/classes/teacher/:teacherId
// @access  Private (Teacher, Admin, HOD)
const getClassesByTeacher = async (req, res) => {
  try {
    const classes = await Class.find({ teacher: req.params.teacherId });
    res.status(200).json({ success: true, data: classes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Get students by class
// @route   GET /api/classes/:classId/students
// @access  Private (Teacher, Admin, HOD)
const getStudentsByClass = async (req, res) => {
  try {
    // Find all enrollments for the given class that are approved
    const enrollments = await Enrollment.find({ class: req.params.classId, status: 'approved' }).populate('student', 'name email');
    
    const students = enrollments.map(enrollment => enrollment.student);

    res.status(200).json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};


module.exports = {
  createClass,
  getAllClasses,
  updateClass,
  deleteClass,
  getClassesByTeacher,
  getStudentsByClass,
};
