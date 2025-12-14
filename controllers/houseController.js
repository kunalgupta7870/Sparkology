const House = require('../models/House');
const Student = require('../models/Student');
const { validationResult } = require('express-validator');

// @desc    Get all houses for a school
// @route   GET /api/houses
// @access  Private (School Admin)
const getHouses = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { isActive } = req.query;

    const houses = await House.getHousesBySchool(
      schoolId,
      isActive === 'false' ? false : isActive === 'true' ? true : null
    );

    // Get student count for each house
    const housesWithCounts = await Promise.all(
      houses.map(async (house) => {
        const studentCount = await Student.countDocuments({
          houseId: house._id,
          status: 'active'
        });
        const houseObj = house.toObject();
        houseObj.studentCount = studentCount;
        return houseObj;
      })
    );

    res.status(200).json({
      success: true,
      count: housesWithCounts.length,
      data: housesWithCounts
    });
  } catch (error) {
    console.error('Get houses error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching houses'
    });
  }
};

// @desc    Get house by ID
// @route   GET /api/houses/:id
// @access  Private (School Admin)
const getHouse = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const house = await House.findOne({
      _id: req.params.id,
      schoolId
    })
      .populate('houseCaptain', 'name email rollNumber classId')
      .populate('viceCaptain', 'name email rollNumber classId')
      .populate('classId', 'name section');

    if (!house) {
      return res.status(404).json({
        success: false,
        error: 'House not found'
      });
    }

    // Get all students in this house
    const students = await Student.find({
      houseId: house._id,
      status: 'active'
    })
      .populate('classId', 'name section')
      .sort({ name: 1 });

    const houseObj = house.toObject();
    houseObj.students = students;
    houseObj.studentCount = students.length;

    res.status(200).json({
      success: true,
      data: houseObj
    });
  } catch (error) {
    console.error('Get house error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching house'
    });
  }
};

// @desc    Create new house
// @route   POST /api/houses
// @access  Private (School Admin)
const createHouse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      name,
      description,
      color,
      houseCaptain,
      viceCaptain
    } = req.body;

    const schoolId = req.user.schoolId;

    // Check if house name already exists in the school
    const existingHouse = await House.findOne({
      name,
      schoolId,
      isActive: true
    });

    if (existingHouse) {
      return res.status(400).json({
        success: false,
        error: 'A house with this name already exists in your school'
      });
    }

    // Validate captains if provided
    if (houseCaptain) {
      const captain = await Student.findOne({
        _id: houseCaptain,
        schoolId,
        status: 'active'
      });
      if (!captain) {
        return res.status(400).json({
          success: false,
          error: 'House captain not found or inactive'
        });
      }
    }

    if (viceCaptain) {
      const vice = await Student.findOne({
        _id: viceCaptain,
        schoolId,
        status: 'active'
      });
      if (!vice) {
        return res.status(400).json({
          success: false,
          error: 'Vice captain not found or inactive'
        });
      }
    }

    const house = await House.create({
      name,
      description,
      color: color || '#3B82F6',
      schoolId,
      createdBy: req.user._id,
      houseCaptain: houseCaptain || null,
      viceCaptain: viceCaptain || null
    });

    // If captains are assigned, assign them to the house
    if (houseCaptain) {
      await Student.findByIdAndUpdate(houseCaptain, { houseId: house._id });
    }
    if (viceCaptain) {
      await Student.findByIdAndUpdate(viceCaptain, { houseId: house._id });
    }

    await house.populate('houseCaptain', 'name email rollNumber');
    await house.populate('viceCaptain', 'name email rollNumber');

    res.status(201).json({
      success: true,
      message: 'House created successfully',
      data: house
    });
  } catch (error) {
    console.error('Create house error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during house creation'
    });
  }
};

// @desc    Update house
// @route   PUT /api/houses/:id
// @access  Private (School Admin)
const updateHouse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const schoolId = req.user.schoolId;
    const house = await House.findOne({
      _id: req.params.id,
      schoolId
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        error: 'House not found'
      });
    }

    const {
      name,
      description,
      color,
      houseCaptain,
      viceCaptain,
      points
    } = req.body;

    // Check if name is being changed and if it conflicts
    if (name && name !== house.name) {
      const existingHouse = await House.findOne({
        name,
        schoolId,
        isActive: true,
        _id: { $ne: req.params.id }
      });

      if (existingHouse) {
        return res.status(400).json({
          success: false,
          error: 'A house with this name already exists in your school'
        });
      }
      house.name = name;
    }

    if (description !== undefined) house.description = description;
    if (color) house.color = color;
    if (points !== undefined) house.points = points;

    // Handle captain updates
    if (houseCaptain !== undefined) {
      if (houseCaptain) {
        const captain = await Student.findOne({
          _id: houseCaptain,
          schoolId,
          status: 'active'
        });
        if (!captain) {
          return res.status(400).json({
            success: false,
            error: 'House captain not found or inactive'
          });
        }
        // Remove old captain from house if different
        if (house.houseCaptain && house.houseCaptain.toString() !== houseCaptain) {
          await Student.findByIdAndUpdate(house.houseCaptain, { houseId: null });
        }
        house.houseCaptain = houseCaptain;
        await Student.findByIdAndUpdate(houseCaptain, { houseId: house._id });
      } else {
        // Remove captain
        if (house.houseCaptain) {
          await Student.findByIdAndUpdate(house.houseCaptain, { houseId: null });
        }
        house.houseCaptain = null;
      }
    }

    if (viceCaptain !== undefined) {
      if (viceCaptain) {
        const vice = await Student.findOne({
          _id: viceCaptain,
          schoolId,
          status: 'active'
        });
        if (!vice) {
          return res.status(400).json({
            success: false,
            error: 'Vice captain not found or inactive'
          });
        }
        // Remove old vice captain from house if different
        if (house.viceCaptain && house.viceCaptain.toString() !== viceCaptain) {
          await Student.findByIdAndUpdate(house.viceCaptain, { houseId: null });
        }
        house.viceCaptain = viceCaptain;
        await Student.findByIdAndUpdate(viceCaptain, { houseId: house._id });
      } else {
        // Remove vice captain
        if (house.viceCaptain) {
          await Student.findByIdAndUpdate(house.viceCaptain, { houseId: null });
        }
        house.viceCaptain = null;
      }
    }

    await house.save();
    await house.populate('houseCaptain', 'name email rollNumber');
    await house.populate('viceCaptain', 'name email rollNumber');

    res.status(200).json({
      success: true,
      message: 'House updated successfully',
      data: house
    });
  } catch (error) {
    console.error('Update house error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during house update'
    });
  }
};

// @desc    Delete house
// @route   DELETE /api/houses/:id
// @access  Private (School Admin)
const deleteHouse = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const house = await House.findOne({
      _id: req.params.id,
      schoolId
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        error: 'House not found'
      });
    }

    // Remove house assignment from all students
    await Student.updateMany(
      { houseId: house._id },
      { $unset: { houseId: 1 } }
    );

    // Soft delete (set isActive to false)
    house.isActive = false;
    await house.save();

    res.status(200).json({
      success: true,
      message: 'House deleted successfully'
    });
  } catch (error) {
    console.error('Delete house error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during house deletion'
    });
  }
};

// @desc    Assign students to house
// @route   POST /api/houses/:id/assign-students
// @access  Private (School Admin)
const assignStudents = async (req, res) => {
  try {
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Student IDs array is required'
      });
    }

    const schoolId = req.user.schoolId;
    const house = await House.findOne({
      _id: req.params.id,
      schoolId,
      isActive: true
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        error: 'House not found'
      });
    }

    // Verify all students belong to the school and are active
    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId,
      status: 'active'
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Some students not found or inactive'
      });
    }

    // Assign students to house
    await Student.updateMany(
      { _id: { $in: studentIds } },
      { houseId: house._id }
    );

    res.status(200).json({
      success: true,
      message: `${studentIds.length} student(s) assigned to house successfully`
    });
  } catch (error) {
    console.error('Assign students error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during student assignment'
    });
  }
};

// @desc    Remove students from house
// @route   POST /api/houses/:id/remove-students
// @access  Private (School Admin)
const removeStudents = async (req, res) => {
  try {
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Student IDs array is required'
      });
    }

    const schoolId = req.user.schoolId;
    const house = await House.findOne({
      _id: req.params.id,
      schoolId
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        error: 'House not found'
      });
    }

    // Remove house assignment
    await Student.updateMany(
      { _id: { $in: studentIds }, houseId: house._id },
      { $unset: { houseId: 1 } }
    );

    res.status(200).json({
      success: true,
      message: `${studentIds.length} student(s) removed from house successfully`
    });
  } catch (error) {
    console.error('Remove students error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during student removal'
    });
  }
};

module.exports = {
  getHouses,
  getHouse,
  createHouse,
  updateHouse,
  deleteHouse,
  assignStudents,
  removeStudents
};

