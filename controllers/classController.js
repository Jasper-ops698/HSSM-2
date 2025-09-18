const Class = require('../models/Class');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');

// @desc    Create a new class
// @route   POST /api/classes
// @access  Private (Admin, HOD)
const createClass = async (req, res) => {
  try {
    const { name, description, teacherId, department, creditsRequired } = req.body;
    const user = req.user;

    if (!name || !description || !department || creditsRequired === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide name, description, department, and credits required.' });
    }

    // For HODs, ensure they can only create classes in their department
    if (user.role === 'HOD' && user.department !== department) {
      return res.status(403).json({ success: false, message: 'HODs can only create classes in their own department.' });
    }

    // For HODs, ensure the teacher is from their department
    if (user.role === 'HOD' && teacherId) {
      const teacher = await User.findById(teacherId);
      if (!teacher || teacher.department !== user.department) {
        return res.status(403).json({ success: false, message: 'You can only assign teachers from your department.' });
      }
    }

    // Find HOD for the department
    const hod = await User.findOne({ role: 'HOD', department });
    if (!hod) {
      return res.status(400).json({ success: false, message: 'No HOD found for this department.' });
    }

    const newClass = new Class({
      name,
      description,
      teacher: teacherId,
      department,
      creditsRequired,
      HOD: hod._id,
    });

    const savedClass = await newClass.save();
    res.status(201).json({ success: true, data: savedClass });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Create a new class by teacher
// @route   POST /api/classes/teacher
// @access  Private (Teacher)
const teacherCreateClass = async (req, res) => {
  try {
    const { name, description, creditsRequired } = req.body;
    const teacherId = req.user._id;
    const teacher = await User.findById(teacherId);

    if (!name || !description || creditsRequired === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide name, description, and credits required.' });
    }

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found.' });
    }

    // Find HOD for the teacher's department
    const hod = await User.findOne({ role: 'HOD', department: teacher.department });
    if (!hod) {
      return res.status(400).json({ success: false, message: 'No HOD found for your department.' });
    }

    const newClass = new Class({
      name,
      description,
      teacher: teacherId,
      department: teacher.department,
      creditsRequired,
      HOD: hod._id,
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
    const user = req.user;
    let query = {};

    // Filter classes based on user role and department
    if (user.role === 'HOD' || user.role === 'student') {
      if (user.department) {
        query.department = user.department;
      }
    } else if (user.role === 'teacher') {
      if (user.department) {
        query.department = user.department;
      } else {
        // Fallback for teachers: show classes they are assigned to if no department is set
        query.teacher = user._id;
      }
    }
    // Admins can see all classes (no filter).

    const classes = await Class.find(query)
      .populate('teacher', 'name email');

    if (classes.length === 0) {
      // To provide a better user experience, send a specific message.
      return res.status(200).json([]); // Return empty array instead of 404
    }

    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Update a class
// @route   PUT /api/classes/:id
// @access  Private (Admin, HOD)
const updateClass = async (req, res) => {
  try {
    const { name, description, teacherId, department, creditsRequired, subject, dayOfWeek, startTime, endTime, venue } = req.body;
    const user = req.user;
    const classToUpdate = await Class.findById(req.params.id);

    if (!classToUpdate) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    // HODs can only update classes in their own department
    if (user.role === 'HOD' && classToUpdate.department !== user.department) {
      return res.status(403).json({ success: false, message: 'You can only update classes in your department.' });
    }

    // Prevent HODs from changing the department of a class
    if (user.role === 'HOD' && department && department !== user.department) {
      return res.status(403).json({ success: false, message: 'You cannot change the department of a class.' });
    }

    // HODs can only assign teachers from their own department
    if (user.role === 'HOD' && teacherId) {
      const teacher = await User.findById(teacherId);
      if (!teacher || teacher.department !== user.department) {
        return res.status(403).json({ success: false, message: 'You can only assign teachers from your department.' });
      }
    }

    // Update fields
    classToUpdate.subject = subject || classToUpdate.subject;
    classToUpdate.dayOfWeek = dayOfWeek || classToUpdate.dayOfWeek;
    classToUpdate.startTime = startTime || classToUpdate.startTime;
    classToUpdate.endTime = endTime || classToUpdate.endTime;
    classToUpdate.venue = venue || classToUpdate.venue;
    
    // Legacy fields (if still used)
    classToUpdate.name = name || classToUpdate.name;
    classToUpdate.description = description || classToUpdate.description;
    classToUpdate.department = department || classToUpdate.department;
    classToUpdate.creditsRequired = creditsRequired !== undefined ? creditsRequired : classToUpdate.creditsRequired;
    if (teacherId) {
        classToUpdate.teacher = teacherId;
    }

    const updatedClass = await classToUpdate.save();
    res.status(200).json(updatedClass);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Delete a class
// @route   DELETE /api/classes/:id
// @access  Private (Admin, HOD)
const deleteClass = async (req, res) => {
  try {
    const user = req.user;
    const classToDelete = await Class.findById(req.params.id);

    if (!classToDelete) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    // HODs can only delete classes in their own department
    if (user.role === 'HOD' && classToDelete.department !== user.department) {
      return res.status(403).json({ success: false, message: 'You can only delete classes in your department.' });
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
  teacherCreateClass,
  getAllClasses,
  updateClass,
  deleteClass,
  getClassesByTeacher,
  getStudentsByClass,
};
