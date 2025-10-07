const express = require('express');
const Product = require('../models/Product');
const School = require('../models/School');
const { protect, isAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// @desc    Get all products
// @route   GET /api/products
// @access  Private (Admin only)
const getProducts = async (req, res) => {
  try {
    const { schoolId, category, status, search, page = 1, limit = 10 } = req.query;
    
    // Build query
    let query = {};
    
    if (schoolId) {
      query.schoolId = schoolId;
    }
    
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
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get products with pagination
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('schoolId', 'name code');

    // Get total count for pagination
    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: products
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private (Admin only)
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('schoolId', 'name code address');

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Admin only)
const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      price,
      stock = 0,
      minimum = 10,
      schoolId,
      supplier,
      specifications
    } = req.body;

    // Verify school exists if schoolId is provided
    if (schoolId) {
      const school = await School.findById(schoolId);
      if (!school) {
        return res.status(400).json({
          success: false,
          error: 'School not found'
        });
      }
    }

    // Create product
    const product = await Product.create({
      name,
      description,
      category,
      price,
      stock,
      minimum,
      schoolId,
      supplier,
      specifications
    });

    // Populate school info
    await product.populate('schoolId', 'name code');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin only)
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const {
      name,
      description,
      category,
      price,
      stock,
      minimum,
      status,
      supplier,
      specifications
    } = req.body;

    // Update fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (category) product.category = category;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (minimum !== undefined) product.minimum = minimum;
    if (status) product.status = status;
    if (supplier) product.supplier = supplier;
    if (specifications) product.specifications = specifications;

    await product.save();

    // Populate school info
    await product.populate('schoolId', 'name code');

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Admin only)
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update product stock
// @route   PUT /api/products/:id/stock
// @access  Private (Admin only)
const updateStock = async (req, res) => {
  try {
    const { quantity, operation = 'add' } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    await product.updateStock(quantity, operation);

    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      data: {
        id: product._id,
        name: product.name,
        stock: product.stock,
        stockStatus: product.stockStatus
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

// @desc    Get low stock products
// @route   GET /api/products/low-stock
// @access  Private (Admin only)
const getLowStockProducts = async (req, res) => {
  try {
    const { schoolId } = req.query;
    
    const query = { stock: { $lte: '$minimum' } };
    if (schoolId) query.schoolId = schoolId;
    
    const products = await Product.find(query)
      .populate('schoolId', 'name code');

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Get low stock products error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get product statistics
// @route   GET /api/products/stats
// @access  Private (Admin only)
const getProductStats = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });
    const inactiveProducts = await Product.countDocuments({ status: 'inactive' });
    const discontinuedProducts = await Product.countDocuments({ status: 'discontinued' });

    const totalStockValue = await Product.aggregate([
      { $group: { _id: null, total: { $sum: { $multiply: ['$stock', '$price'] } } } }
    ]);

    const productsByCategory = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const productsBySchool = await Product.aggregate([
      { $group: { _id: '$schoolId', count: { $sum: 1 } } },
      { $lookup: { from: 'schools', localField: '_id', foreignField: '_id', as: 'school' } },
      { $unwind: '$school' },
      { $project: { schoolName: '$school.name', schoolCode: '$school.code', count: 1 } }
    ]);

    const lowStockProducts = await Product.countDocuments({
      $expr: { $lte: ['$stock', '$minimum'] }
    });

    const recentProducts = await Product.find()
      .select('name category stock status createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        totalProducts,
        activeProducts,
        inactiveProducts,
        discontinuedProducts,
        totalStockValue: totalStockValue[0]?.total || 0,
        productsByCategory,
        productsBySchool,
        lowStockProducts,
        recentProducts
      }
    });
  } catch (error) {
    console.error('Get product stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Routes
router.get('/', isAdmin, getProducts);
router.get('/low-stock', isAdmin, getLowStockProducts);
router.get('/stats', isAdmin, getProductStats);
router.get('/:id', isAdmin, getProduct);
router.post('/', isAdmin, createProduct);
router.put('/:id', isAdmin, updateProduct);
router.put('/:id/stock', isAdmin, updateStock);
router.delete('/:id', isAdmin, deleteProduct);

module.exports = router;
