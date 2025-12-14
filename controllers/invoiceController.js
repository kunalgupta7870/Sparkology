const Invoice = require('../models/Invoice');
const Student = require('../models/Student');
const School = require('../models/School');

// @desc    Create a new invoice
// @route   POST /api/invoices
// @access  Private (School Admin)
const createInvoice = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const {
      studentId,
      studentName,
      admissionNumber,
      className,
      items,
      totalAmount,
      invoiceNumber,
      invoiceDate,
      dueDate,
      paymentStatus,
      remarks
    } = req.body;

    // Validation
    if (!studentId || !studentName || !items || !totalAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: studentId, studentName, items, totalAmount'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invoice must have at least one item'
      });
    }

    // Verify student exists and belongs to this school
    const student = await Student.findOne({ _id: studentId, schoolId });
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found or does not belong to your school'
      });
    }

    // Create invoice
    const invoice = await Invoice.create({
      schoolId,
      studentId,
      studentName,
      admissionNumber,
      className,
      items,
      totalAmount,
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      invoiceDate: invoiceDate || new Date(),
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      paymentStatus: paymentStatus || 'pending',
      remarks: remarks || '',
      createdBy: req.user._id
    });

    console.log(`✅ Invoice created: ${invoice._id} for student ${studentName}`);

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice
    });
  } catch (error) {
    console.error('❌ Error creating invoice:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error while creating invoice'
    });
  }
};

// @desc    Get all invoices for a school
// @route   GET /api/invoices
// @access  Private (School Admin)
const getInvoices = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { page = 1, limit = 50, studentId, status } = req.query;

    const query = { schoolId };
    if (studentId) query.studentId = studentId;
    if (status) query.paymentStatus = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('studentId', 'name admissionNumber email phone');

    const total = await Invoice.countDocuments(query);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('❌ Error fetching invoices:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching invoices'
    });
  }
};

// @desc    Get a single invoice by ID
// @route   GET /api/invoices/:id
// @access  Private (School Admin)
const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      schoolId: req.user.schoolId
    }).populate('studentId', 'name admissionNumber email phone classId');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('❌ Error fetching invoice:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching invoice'
    });
  }
};

// @desc    Update an invoice
// @route   PUT /api/invoices/:id
// @access  Private (School Admin)
const updateInvoice = async (req, res) => {
  try {
    const { paymentStatus, remarks, items, totalAmount, dueDate } = req.body;

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      schoolId: req.user.schoolId
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    // Update fields
    if (paymentStatus) invoice.paymentStatus = paymentStatus;
    if (remarks !== undefined) invoice.remarks = remarks;
    if (items) invoice.items = items;
    if (totalAmount) invoice.totalAmount = totalAmount;
    if (dueDate) invoice.dueDate = dueDate;

    await invoice.save();

    console.log(`✅ Invoice updated: ${invoice._id}`);

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoice
    });
  } catch (error) {
    console.error('❌ Error updating invoice:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error while updating invoice'
    });
  }
};

// @desc    Delete an invoice
// @route   DELETE /api/invoices/:id
// @access  Private (School Admin)
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      schoolId: req.user.schoolId
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    await Invoice.deleteOne({ _id: invoice._id });

    console.log(`✅ Invoice deleted: ${invoice._id}`);

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting invoice:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting invoice'
    });
  }
};

// @desc    Get invoice statistics
// @route   GET /api/invoices/stats/summary
// @access  Private (School Admin)
const getInvoiceStats = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const stats = await Invoice.aggregate([
      { $match: { schoolId: new (require('mongoose')).Types.ObjectId(schoolId) } },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalInvoices = await Invoice.countDocuments({ schoolId });
    const totalRevenue = await Invoice.aggregate([
      { $match: { schoolId: new (require('mongoose')).Types.ObjectId(schoolId) } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalInvoices,
        totalRevenue: totalRevenue[0]?.total || 0,
        byStatus: stats
      }
    });
  } catch (error) {
    console.error('❌ Error fetching invoice stats:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching statistics'
    });
  }
};

module.exports = {
  createInvoice,
  getInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoiceStats
};
