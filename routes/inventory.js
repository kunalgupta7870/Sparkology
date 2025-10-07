const express = require('express');
const Inventory = require('../models/Inventory');
const { protect, isAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// @desc    Get all inventory items
// @route   GET /api/inventory
// @access  Private (Admin only)
const getInventoryItems = async (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 10 } = req.query;
    
    // Build query
    let query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get inventory items with pagination
    const items = await Inventory.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Inventory.countDocuments(query);

    res.status(200).json({
      success: true,
      count: items.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: items
    });
  } catch (error) {
    console.error('Get inventory items error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get single inventory item
// @route   GET /api/inventory/:id
// @access  Private (Admin only)
const getInventoryItem = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Inventory item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Create new inventory item
// @route   POST /api/inventory
// @access  Private (Admin only)
const createInventoryItem = async (req, res) => {
  try {
    const {
      name,
      description,
      current = 0,
      minimum = 10,
      price = 0,
      category = 'Inventory',
      status = 'active',
      notes
    } = req.body;

    // Create inventory item
    const item = await Inventory.create({
      name,
      description,
      current,
      minimum,
      price,
      category,
      status,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: item
    });
  } catch (error) {
    console.error('Create inventory item error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update inventory item
// @route   PUT /api/inventory/:id
// @access  Private (Admin only)
const updateInventoryItem = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Inventory item not found'
      });
    }

    const {
      name,
      description,
      current,
      minimum,
      price,
      category,
      status,
      notes
    } = req.body;

    // Update fields
    if (name) item.name = name;
    if (description) item.description = description;
    if (current !== undefined) item.current = current;
    if (minimum !== undefined) item.minimum = minimum;
    if (price !== undefined) item.price = price;
    if (category) item.category = category;
    if (status) item.status = status;
    if (notes !== undefined) item.notes = notes;

    await item.save();

    res.status(200).json({
      success: true,
      message: 'Inventory item updated successfully',
      data: item
    });
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Delete inventory item
// @route   DELETE /api/inventory/:id
// @access  Private (Admin only)
const deleteInventoryItem = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Inventory item not found'
      });
    }

    await Inventory.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update inventory stock
// @route   PUT /api/inventory/:id/stock
// @access  Private (Admin only)
const updateStock = async (req, res) => {
  try {
    const { quantity, operation = 'add' } = req.body;
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Inventory item not found'
      });
    }

    await item.updateStock(quantity, operation);

    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      data: {
        id: item._id,
        name: item.name,
        current: item.current,
        stockStatus: item.stockStatus
      }
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Get low stock items
// @route   GET /api/inventory/low-stock
// @access  Private (Admin only)
const getLowStockItems = async (req, res) => {
  try {
    const items = await Inventory.getLowStockItems();

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Get low stock items error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get inventory statistics
// @route   GET /api/inventory/stats
// @access  Private (Admin only)
const getInventoryStats = async (req, res) => {
  try {
    const totalItems = await Inventory.countDocuments();
    const activeItems = await Inventory.countDocuments({ status: 'active' });
    const inactiveItems = await Inventory.countDocuments({ status: 'inactive' });
    const discontinuedItems = await Inventory.countDocuments({ status: 'discontinued' });

    const totalValue = await Inventory.aggregate([
      { $group: { _id: null, total: { $sum: { $multiply: ['$current', '$price'] } } } }
    ]);

    const itemsByCategory = await Inventory.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const lowStockItems = await Inventory.countDocuments({
      $expr: { $lte: ['$current', '$minimum'] }
    });

    const recentItems = await Inventory.find()
      .select('name category current status createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        totalItems,
        activeItems,
        inactiveItems,
        discontinuedItems,
        totalValue: totalValue[0]?.total || 0,
        itemsByCategory,
        lowStockItems,
        recentItems
      }
    });
  } catch (error) {
    console.error('Get inventory stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Routes
router.get('/', isAdmin, getInventoryItems);
router.get('/low-stock', isAdmin, getLowStockItems);
router.get('/stats', isAdmin, getInventoryStats);
router.get('/:id', isAdmin, getInventoryItem);
router.post('/', isAdmin, createInventoryItem);
router.put('/:id', isAdmin, updateInventoryItem);
router.put('/:id/stock', isAdmin, updateStock);
router.delete('/:id', isAdmin, deleteInventoryItem);

module.exports = router;
