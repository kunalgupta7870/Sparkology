const express = require('express');
const Product = require('../models/Product');
const School = require('../models/School');
const Order = require('../models/Order');
const { protect, isAdmin } = require('../middleware/auth');
const { uploadProductImage, handleUploadError } = require('../utils/cloudinary');
const { createOrder, verifyPayment, fetchPayment } = require('../utils/razorpay');

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
      schoolId,
      supplier,
      specifications,
      images
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
      schoolId,
      supplier,
      specifications,
      images: images || []
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
      status,
      supplier,
      specifications,
      images
    } = req.body;

    // Update fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (category) product.category = category;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (status) product.status = status;
    if (supplier) product.supplier = supplier;
    if (specifications) product.specifications = specifications;
    if (images !== undefined) product.images = images;

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
    
    const query = { $expr: { $lte: ['$stock', '$reorderPoint'] } };
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
      $expr: { $lte: ['$stock', '$reorderPoint'] }
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

// @desc    Create Razorpay order for product purchase
// @route   POST /api/products/:id/purchase
// @access  Private
const purchaseProduct = async (req, res) => {
  try {
    const { quantity = 1, customer, razorpay_order_id, razorpay_payment_id, razorpay_signature, billingAddress } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Check if product is active
    if (product.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Product is not available for purchase'
      });
    }

    // Check if sufficient stock is available
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient stock. Only ${product.stock} units available`
      });
    }

    // If payment verification data is provided, verify and complete purchase
    if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      // Verify payment signature
      const isVerified = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      
      if (!isVerified) {
        return res.status(400).json({
          success: false,
          error: 'Payment verification failed'
        });
      }

      // Fetch payment details from Razorpay
      const paymentDetails = await fetchPayment(razorpay_payment_id);
      
      if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
        return res.status(400).json({
          success: false,
          error: `Payment status is ${paymentDetails.status}, expected captured or authorized`
        });
      }

      const userId = req.user._id;
      const totalAmount = product.price * quantity;

      // Update stock
      await product.updateStock(quantity, 'subtract');
      await product.recordSale(quantity, product.price, customer || req.user?.name || 'Unknown');

      // Create order record
      const order = await Order.create({
        userId,
        userModel: req.user.role === 'student' ? 'Student' : req.user.role === 'parent' ? 'Parent' : 'User',
        items: [{
          productId: product._id,
          type: 'product',
          name: product.name,
          price: product.price,
          quantity: quantity,
          subtotal: totalAmount
        }],
        billingAddress: billingAddress || {
          name: req.user.name || '',
          email: req.user.email || ''
        },
        paymentMethod: {
          type: 'razorpay',
          name: 'Razorpay'
        },
        pricing: {
          subtotal: totalAmount,
          discount: 0,
          paymentFee: 0,
          total: totalAmount
        },
        status: 'completed',
        paymentStatus: 'paid',
        transactionId: razorpay_payment_id,
        completedAt: new Date()
      });

      // Populate and return updated product
      await product.populate('schoolId', 'name code');

      return res.status(200).json({
        success: true,
        message: 'Purchase successful',
        data: {
          id: product._id,
          name: product.name,
          stock: product.stock,
          stockStatus: product.stockStatus,
          price: product.price,
          quantityPurchased: quantity,
          totalAmount: totalAmount,
          order: order
        }
      });
    }

    // If no payment data, create Razorpay order for payment
    const totalAmount = product.price * quantity;
    const userId = req.user._id;

    // Create short receipt (Razorpay requires max 40 characters)
    const receipt = `PRD${product._id.toString().slice(-8)}${Date.now().toString().slice(-8)}`;
    
    const order = await createOrder(totalAmount, 'INR', {
      receipt: receipt,
      notes: {
        type: 'product',
        productId: product._id.toString(),
        productName: product.name,
        quantity: quantity.toString(),
        userId: userId.toString()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        productId: product._id,
        productName: product.name,
        quantity: quantity,
        unitPrice: product.price,
        totalAmount: totalAmount
      }
    });
  } catch (error) {
    console.error('Purchase product error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Upload product image
// @route   POST /api/products/upload-image
// @access  Private (Admin only)
const handleProductImageUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // The file is already uploaded to Cloudinary by multer middleware
    const imageUrl = req.file.path;
    
    res.status(200).json({
      success: true,
      data: {
        url: imageUrl,
        alt: req.body.alt || '',
        isPrimary: req.body.isPrimary === 'true'
      }
    });
  } catch (error) {
    console.error('Upload product image error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Routes
router.get('/', getProducts); // Available to all authenticated users (students can browse)
router.get('/low-stock', isAdmin, getLowStockProducts);
router.get('/stats', isAdmin, getProductStats);
router.get('/:id', getProduct); // Available to all authenticated users (students can view details)
router.post('/', isAdmin, createProduct);
router.post('/upload-image', isAdmin, uploadProductImage.single('file'), handleUploadError, handleProductImageUpload);
router.post('/:id/purchase', purchaseProduct); // Available to all authenticated users (creates payment order or verifies payment)
router.put('/:id', isAdmin, updateProduct);
router.put('/:id/stock', isAdmin, updateStock);
router.delete('/:id', isAdmin, deleteProduct);

module.exports = router;
