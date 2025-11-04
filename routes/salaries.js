const express = require('express');
const {
  getSalaries,
  getSalary,
  createSalary,
  updateSalary,
  deleteSalary,
  markSalaryAsPaid,
  getSalaryStats,
  getSalaryStructures,
  generatePayroll
} = require('../controllers/salaryController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes - allow school_admin and accountant
router.get('/stats/overview', authorize('school_admin', 'accountant'), getSalaryStats);
router.get('/structures', authorize('school_admin', 'accountant'), getSalaryStructures);
router.post('/generate-payroll', authorize('school_admin', 'accountant'), generatePayroll);
router.get('/', authorize('school_admin', 'accountant'), getSalaries);
router.get('/:id', authorize('school_admin', 'accountant'), getSalary);
router.post('/', authorize('school_admin', 'accountant'), createSalary);
router.put('/:id', authorize('school_admin', 'accountant'), updateSalary);
router.put('/:id/pay', authorize('school_admin', 'accountant'), markSalaryAsPaid);
router.delete('/:id', authorize('school_admin', 'accountant'), deleteSalary);

module.exports = router;

