const express = require('express');
const SchoolProduct = require('../models/SchoolProduct');
const School = require('../models/School');
const { protect, isAdmin, isSchoolAdmin, authorize } = require('../middleware/auth');
const { uploadProductImage, handleUploadError } = require('../utils/cloudinary');
const { createOrder, verifyPayment, fetchPayment } = require('../utils/razorpay');

const router = express.Router();

// All routes are protected
router.use(protect);

// @desc    Get all school products
// @route   GET /api/school-products
// @access  Private (School Admin & Admin)
const getSchoolProducts = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    // Build query - only active products for school admins, all for admins
    let query = {};
    
    if (req.user.role !== 'admin') {
      query.status = 'active';
    } else if (status) {
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
    const products = await SchoolProduct.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await SchoolProduct.countDocuments(query);

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
    console.error('Get school products error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get single school product
// @route   GET /api/school-products/:id
// @access  Private (School Admin & Admin)
const getSchoolProduct = async (req, res) => {
  try {
    const product = await SchoolProduct.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // School admins can only see active products
    if (req.user.role !== 'admin' && product.status !== 'active') {
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
    console.error('Get school product error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Create new school product
// @route   POST /api/school-products
// @access  Private (Admin only)
const createSchoolProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      stock = 0,
      supplier,
      specifications,
      images,
      features,
      minimumPurchaseQuantity,
      tags
    } = req.body;

    // Create product
    const product = await SchoolProduct.create({
      name,
      description,
      price,
      stock,
      supplier,
      specifications,
      images: images || [],
      features: features || [],
      minimumPurchaseQuantity,
      tags: tags || []
    });

    res.status(201).json({
      success: true,
      message: 'School product created successfully',
      data: product
    });
  } catch (error) {
    console.error('Create school product error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update school product
// @route   PUT /api/school-products/:id
// @access  Private (Admin only)
const updateSchoolProduct = async (req, res) => {
  try {
    const product = await SchoolProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const {
      name,
      description,
      price,
      stock,
      status,
      supplier,
      specifications,
      images,
      features,
      minimumPurchaseQuantity,
      tags,
      pricing
    } = req.body;

    // Update fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (status) product.status = status;
    if (supplier) product.supplier = supplier;
    if (specifications) product.specifications = specifications;
    if (images !== undefined) product.images = images;
    if (features !== undefined) product.features = features;
    if (minimumPurchaseQuantity) product.minimumPurchaseQuantity = minimumPurchaseQuantity;
    if (tags !== undefined) product.tags = tags;
    if (pricing) product.pricing = { ...product.pricing, ...pricing };

    await product.save();

    res.status(200).json({
      success: true,
      message: 'School product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update school product error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Delete school product
// @route   DELETE /api/school-products/:id
// @access  Private (Admin only)
const deleteSchoolProduct = async (req, res) => {
  try {
    const product = await SchoolProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    await SchoolProduct.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'School product deleted successfully'
    });
  } catch (error) {
    console.error('Delete school product error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Purchase school product (creates payment order or verifies payment)
// @route   POST /api/school-products/:id/purchase
// @access  Private (School Admin only)
const purchaseSchoolProduct = async (req, res) => {
  try {
    const { quantity = 1, razorpay_order_id, razorpay_payment_id, razorpay_signature, billingAddress } = req.body;
    const product = await SchoolProduct.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Check if product is available for purchase
    if (!product.isAvailable(quantity)) {
      if (product.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Product is not available for purchase'
        });
      }
      
      if (quantity < product.minimumPurchaseQuantity) {
        return res.status(400).json({
          success: false,
          error: `Minimum purchase quantity is ${product.minimumPurchaseQuantity}`
        });
      }
      
      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock. Only ${product.stock} units available`
        });
      }
    }

    // Get school information
    const school = await School.findById(req.user.schoolId);
    if (!school) {
      return res.status(400).json({
        success: false,
        error: 'School not found'
      });
    }

    // Calculate price with bulk discount
    const unitPrice = product.getBulkPrice(quantity);
    const totalAmount = unitPrice * quantity;

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

      // Record the purchase
      await product.recordPurchase(
        school._id,
        school.name,
        quantity,
        unitPrice
      );

      return res.status(200).json({
        success: true,
        message: 'Purchase successful',
        data: {
          id: product._id,
          name: product.name,
          quantity,
          unitPrice,
          totalAmount,
          stock: product.stock,
          transactionId: razorpay_payment_id
        }
      });
    }

    // If no payment data, create Razorpay order for payment
    const userId = req.user._id;
    
    // Validate Razorpay configuration
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay configuration is missing. Please check your environment variables.'
      });
    }

    try {
      // Create short receipt (Razorpay requires max 40 characters)
      const receipt = `SP${product._id.toString().slice(-8)}${Date.now().toString().slice(-8)}`;
      
      const order = await createOrder(totalAmount, 'INR', {
        receipt: receipt,
        notes: {
          type: 'school_product',
          productId: product._id.toString(),
          productName: product.name,
          schoolId: school._id.toString(),
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
          unitPrice: unitPrice,
          totalAmount: totalAmount
        }
      });
    } catch (razorpayError) {
      console.error('Razorpay order creation error:', razorpayError);
      return res.status(500).json({
        success: false,
        error: razorpayError.message || 'Failed to create Razorpay order. Please check your Razorpay configuration.'
      });
    }
  } catch (error) {
    console.error('Purchase school product error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Get school's purchase history
// @route   GET /api/school-products/purchases/history
// @access  Private (School Admin)
const getSchoolPurchaseHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get all products that this school has purchased
    const products = await SchoolProduct.find({
      'purchaseHistory.schoolId': req.user.schoolId
    });

    // Extract and flatten purchase history for this school
    let purchases = [];
    products.forEach(product => {
      const schoolPurchases = product.purchaseHistory
        .filter(p => p.schoolId.toString() === req.user.schoolId.toString())
        .map(p => ({
          ...p.toObject(),
          productId: product._id,
          productName: product.name,
          productSku: product.sku
        }));
      purchases = purchases.concat(schoolPurchases);
    });

    // Sort by purchase date (newest first)
    purchases.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));

    // Paginate
    const total = purchases.length;
    const paginatedPurchases = purchases.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      count: paginatedPurchases.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: paginatedPurchases
    });
  } catch (error) {
    console.error('Get purchase history error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get all purchases across all schools (Admin only)
// @route   GET /api/school-products/purchases/all
// @access  Private (Admin only)
const getAllPurchases = async (req, res) => {
  try {
    const { page = 1, limit = 20, schoolId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get all products with purchase history
    const products = await SchoolProduct.find({
      'purchaseHistory.0': { $exists: true } // Only products with purchase history
    });

    // Extract and flatten all purchase history
    let purchases = [];
    products.forEach(product => {
      const productPurchases = product.purchaseHistory.map(p => ({
        _id: p._id,
        schoolId: p.schoolId,
        schoolName: p.schoolName,
        purchaseDate: p.purchaseDate,
        quantity: p.quantity,
        price: p.price,
        totalAmount: p.totalAmount,
        status: p.status,
        productId: product._id,
        productName: product.name,
        productSku: product.sku,
        currentStock: product.stock
      }));
      purchases = purchases.concat(productPurchases);
    });

    // Filter by schoolId if provided
    if (schoolId) {
      purchases = purchases.filter(p => p.schoolId.toString() === schoolId);
    }

    // Sort by purchase date (newest first)
    purchases.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));

    // Paginate
    const total = purchases.length;
    const paginatedPurchases = purchases.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      count: paginatedPurchases.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: paginatedPurchases
    });
  } catch (error) {
    console.error('Get all purchases error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get product statistics
// @route   GET /api/school-products/stats
// @access  Private (Admin only)
const getProductStats = async (req, res) => {
  try {
    const totalProducts = await SchoolProduct.countDocuments();
    const activeProducts = await SchoolProduct.countDocuments({ status: 'active' });
    const inactiveProducts = await SchoolProduct.countDocuments({ status: 'inactive' });
    const discontinuedProducts = await SchoolProduct.countDocuments({ status: 'discontinued' });

    const totalRevenue = await SchoolProduct.aggregate([
      { $group: { _id: null, total: { $sum: '$totalRevenue' } } }
    ]);

    const totalPurchases = await SchoolProduct.aggregate([
      { $group: { _id: null, total: { $sum: '$totalPurchases' } } }
    ]);

    const topSellingProducts = await SchoolProduct.find()
      .select('name totalPurchases totalRevenue')
      .sort({ totalPurchases: -1 })
      .limit(5);

    const recentProducts = await SchoolProduct.find()
      .select('name stock status createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        totalProducts,
        activeProducts,
        inactiveProducts,
        discontinuedProducts,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalPurchases: totalPurchases[0]?.total || 0,
        topSellingProducts,
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

// @desc    Upload product image
// @route   POST /api/school-products/upload-image
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
router.get('/', authorize('admin', 'school_admin', 'accountant'), getSchoolProducts);
router.get('/purchases/all', isAdmin, getAllPurchases);
router.get('/purchases/history', authorize('school_admin', 'accountant'), getSchoolPurchaseHistory);
router.get('/stats', isAdmin, getProductStats);
router.get('/:id', authorize('admin', 'school_admin', 'accountant'), getSchoolProduct);
router.post('/', isAdmin, createSchoolProduct);
router.post('/upload-image', isAdmin, uploadProductImage.single('file'), handleUploadError, handleProductImageUpload);
router.post('/:id/purchase', authorize('school_admin', 'accountant'), purchaseSchoolProduct); // Creates payment order or verifies payment
router.put('/:id', isAdmin, updateSchoolProduct);
router.delete('/:id', isAdmin, deleteSchoolProduct);

module.exports = router;

