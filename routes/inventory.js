const express = require('express');
const router = express.Router();
const { createItem, getItems, getItemById, updateItem, deleteItem } = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');
const { uploadInventoryImages, handleUploadError } = require('../utils/cloudinary');
const { body } = require('express-validator');

router.use(protect);

// Accept multipart/form-data to allow image uploads (images field)
router.post(
	'/',
	uploadInventoryImages.array('images', 5),
	handleUploadError,
	[
		body('name').notEmpty().withMessage('Name is required'),
		body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
		body('sku').notEmpty().withMessage('SKU is required'),
		// Add more fields as per your InventoryItem schema
	],
	createItem
);
router.get('/', getItems);
router.get('/:id', getItemById);
// Allow images on update as well
router.put('/:id', uploadInventoryImages.array('images', 5), handleUploadError, updateItem);
router.delete('/:id', deleteItem);

module.exports = router;
