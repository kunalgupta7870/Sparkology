const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  createInvoice,
  getInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoiceStats
} = require('../controllers/invoiceController');

const router = express.Router();

// Protect all routes - require authentication
router.use(protect);

// @route   GET /api/invoices/stats/summary
// @access  Private (School Admin)
router.get('/stats/summary', authorize('school_admin'), getInvoiceStats);

// @route   GET /api/invoices
// @access  Private (School Admin)
router.get('/', authorize('school_admin'), getInvoices);

// @route   POST /api/invoices
// @access  Private (School Admin)
router.post('/', authorize('school_admin'), createInvoice);

// @route   GET /api/invoices/:id
// @access  Private (School Admin)
router.get('/:id', authorize('school_admin'), getInvoice);

// @route   PUT /api/invoices/:id
// @access  Private (School Admin)
router.put('/:id', authorize('school_admin'), updateInvoice);

// @route   DELETE /api/invoices/:id
// @access  Private (School Admin)
router.delete('/:id', authorize('school_admin'), deleteInvoice);

module.exports = router;
