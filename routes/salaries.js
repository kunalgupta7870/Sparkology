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
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes
router.get('/stats/overview', getSalaryStats);
router.get('/structures', getSalaryStructures);
router.post('/generate-payroll', generatePayroll);
router.get('/', getSalaries);
router.get('/:id', getSalary);
router.post('/', createSalary);
router.put('/:id', updateSalary);
router.put('/:id/pay', markSalaryAsPaid);
router.delete('/:id', deleteSalary);

module.exports = router;

