const express = require('express');
const Bill = require('../models/Bill');
const School = require('../models/School');
const { protect, isAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// @desc    Get all bills
// @route   GET /api/billing
// @access  Private (Admin only)
const getBills = async (req, res) => {
  try {
    const { schoolId, status, category, search, page = 1, limit = 10 } = req.query;
    
    // Build query
    let query = {};
    
    if (schoolId) {
      query.school = schoolId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { schoolName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get bills with pagination
    const bills = await Bill.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('school', 'name code address')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');

    // Get total count for pagination
    const total = await Bill.countDocuments(query);

    res.status(200).json({
      success: true,
      count: bills.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: bills
    });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get single bill
// @route   GET /api/billing/:id
// @access  Private (Admin only)
const getBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('school', 'name code address contact')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');

    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bill
    });
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Create new bill
// @route   POST /api/billing
// @access  Private (Admin only)
const createBill = async (req, res) => {
  try {
    const {
      school,
      schoolName,
      amount,
      dueDate,
      description,
      category = 'subscription',
      billingPeriod,
      items = [],
      tax = { rate: 0, amount: 0 },
      discount = { type: 'fixed', value: 0, amount: 0 }
    } = req.body;

    // Verify school exists
    const schoolData = await School.findById(school);
    if (!schoolData) {
      return res.status(400).json({
        success: false,
        error: 'School not found'
      });
    }

    // Create bill
    const bill = await Bill.create({
      school,
      schoolName: schoolName || schoolData.name,
      amount,
      dueDate,
      description,
      category,
      billingPeriod,
      items,
      tax,
      discount,
      createdBy: req.user._id
    });

    // Populate related data
    await bill.populate('school', 'name code address');
    await bill.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: bill
    });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update bill
// @route   PUT /api/billing/:id
// @access  Private (Admin only)
const updateBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    const {
      schoolName,
      amount,
      dueDate,
      description,
      status,
      category,
      billingPeriod,
      items,
      tax,
      discount,
      notes
    } = req.body;

    // Update fields
    if (schoolName) bill.schoolName = schoolName;
    if (amount !== undefined) bill.amount = amount;
    if (dueDate) bill.dueDate = dueDate;
    if (description) bill.description = description;
    if (status) bill.status = status;
    if (category) bill.category = category;
    if (billingPeriod) bill.billingPeriod = billingPeriod;
    if (items) bill.items = items;
    if (tax) bill.tax = tax;
    if (discount) bill.discount = discount;
    if (notes !== undefined) bill.notes = notes;

    await bill.save();

    // Populate related data
    await bill.populate('school', 'name code address');
    await bill.populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Bill updated successfully',
      data: bill
    });
  } catch (error) {
    console.error('Update bill error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Mark bill as paid
// @route   PUT /api/billing/:id/pay
// @access  Private (Admin only)
const markBillAsPaid = async (req, res) => {
  try {
    const { paymentMethod, transactionId, paymentReference, notes } = req.body;
    const bill = await Bill.findById(req.params.id);
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    if (bill.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Bill is already paid'
      });
    }

    const paymentDetails = {
      paymentMethod: paymentMethod || 'online',
      transactionId,
      paymentReference,
      notes
    };

    await bill.markAsPaid(paymentDetails);

    res.status(200).json({
      success: true,
      message: 'Bill marked as paid successfully',
      data: bill
    });
  } catch (error) {
    console.error('Mark bill as paid error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Cancel bill
// @route   PUT /api/billing/:id/cancel
// @access  Private (Admin only)
const cancelBill = async (req, res) => {
  try {
    const { reason } = req.body;
    const bill = await Bill.findById(req.params.id);
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    if (bill.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Bill is already cancelled'
      });
    }

    await bill.cancelBill(reason || 'Cancelled by admin');

    res.status(200).json({
      success: true,
      message: 'Bill cancelled successfully',
      data: bill
    });
  } catch (error) {
    console.error('Cancel bill error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get overdue bills
// @route   GET /api/billing/overdue
// @access  Private (Admin only)
const getOverdueBills = async (req, res) => {
  try {
    const bills = await Bill.find({
      status: 'overdue',
      dueDate: { $lt: new Date() }
    })
    .populate('school', 'name code contact')
    .sort({ dueDate: 1 });

    res.status(200).json({
      success: true,
      count: bills.length,
      data: bills
    });
  } catch (error) {
    console.error('Get overdue bills error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get billing statistics
// @route   GET /api/billing/stats
// @access  Private (Admin only)
const getBillingStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to current month if no dates provided
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const totalBills = await Bill.countDocuments({
      createdAt: { $gte: start, $lte: end }
    });

    const paidBills = await Bill.countDocuments({
      status: 'paid',
      createdAt: { $gte: start, $lte: end }
    });

    const pendingBills = await Bill.countDocuments({
      status: 'pending',
      createdAt: { $gte: start, $lte: end }
    });

    const overdueBills = await Bill.countDocuments({
      status: 'overdue',
      createdAt: { $gte: start, $lte: end }
    });

    const revenueSummary = await Bill.getRevenueSummary(start, end);

    const billsByStatus = await Bill.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' }
        }
      }
    ]);

    const billsByCategory = await Bill.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' }
        }
      }
    ]);

    const recentBills = await Bill.find()
      .select('invoiceNumber schoolName amount status dueDate createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        period: { start, end },
        totalBills,
        paidBills,
        pendingBills,
        overdueBills,
        revenueSummary: revenueSummary[0] || { totalRevenue: 0, totalBills: 0, averageBillAmount: 0 },
        billsByStatus,
        billsByCategory,
        recentBills
      }
    });
  } catch (error) {
    console.error('Get billing stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Routes
router.get('/', isAdmin, getBills);
router.get('/overdue', isAdmin, getOverdueBills);
router.get('/stats', isAdmin, getBillingStats);
router.get('/:id', isAdmin, getBill);
router.post('/', isAdmin, createBill);
router.put('/:id', isAdmin, updateBill);
router.put('/:id/pay', isAdmin, markBillAsPaid);
router.put('/:id/cancel', isAdmin, cancelBill);

module.exports = router;
