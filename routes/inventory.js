const express = require('express');
const router = express.Router();
const { createItem, getItems, getItemById, updateItem, deleteItem } = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', createItem);
router.get('/', getItems);
router.get('/:id', getItemById);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);

module.exports = router;
