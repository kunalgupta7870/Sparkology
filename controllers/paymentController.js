const { createOrder, verifyPayment, fetchPayment } = require('../utils/razorpay');
const Course = require('../models/Course');
const Product = require('../models/Product');
const SchoolProduct = require('../models/SchoolProduct');
const Order = require('../models/Order');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Create Razorpay order for course payment
 * @route   POST /api/courses/:id/payment/create
 * @access  Private
 */
const createCoursePayment = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Find the course
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    // Check if course has a price
    if (!course.price || course.price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Course is free and does not require payment'
      });
    }

    // Create Razorpay order
    const order = await createOrder(course.price, course.currency || 'INR', {
      receipt: `course_${course._id}_${userId}_${Date.now()}`,
      notes: {
        type: 'course',
        courseId: course._id.toString(),
        courseName: course.name,
        userId: userId.toString()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        orderId: order.id,
        amount: order.amount / 100, // Convert back from paise
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        courseId: course._id,
        courseName: course.name,
        coursePrice: course.price
      }
    });
  } catch (error) {
    console.error('Create course payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create payment order'
    });
  }
});

/**
 * @desc    Create Razorpay order for product payment
 * @route   POST /api/products/:id/payment/create
 * @access  Private
 */
const createProductPayment = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity = 1 } = req.body;
    const userId = req.user._id;

    // Find the product
    const product = await Product.findById(id);
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

    // Check stock
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient stock. Only ${product.stock} units available`
      });
    }

    const totalAmount = product.price * quantity;

    // Create Razorpay order
    const order = await createOrder(totalAmount, 'INR', {
      receipt: `product_${product._id}_${userId}_${Date.now()}`,
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
        amount: order.amount / 100, // Convert back from paise
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
    console.error('Create product payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create payment order'
    });
  }
});

/**
 * @desc    Create Razorpay order for school product payment
 * @route   POST /api/school-products/:id/payment/create
 * @access  Private (School Admin)
 */
const createSchoolProductPayment = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity = 1 } = req.body;
    const userId = req.user._id;
    const schoolId = req.user.schoolId;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required'
      });
    }

    // Find the school product
    const product = await SchoolProduct.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Check if product is available for purchase
    if (product.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Product is not available for purchase'
      });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient stock. Only ${product.stock} units available`
      });
    }

    // Calculate price with bulk discount
    const unitPrice = product.getBulkPrice(quantity);
    const totalAmount = unitPrice * quantity;

    // Create Razorpay order
    const order = await createOrder(totalAmount, 'INR', {
      receipt: `school_product_${product._id}_${schoolId}_${Date.now()}`,
      notes: {
        type: 'school_product',
        productId: product._id.toString(),
        productName: product.name,
        schoolId: schoolId.toString(),
        quantity: quantity.toString(),
        userId: userId.toString()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        orderId: order.id,
        amount: order.amount / 100, // Convert back from paise
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        productId: product._id,
        productName: product.name,
        quantity: quantity,
        unitPrice: unitPrice,
        totalAmount: totalAmount
      }
    });
  } catch (error) {
    console.error('Create school product payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create payment order'
    });
  }
});

/**
 * @desc    Verify Razorpay payment and complete purchase
 * @route   POST /api/payments/verify
 * @access  Private
 */
const verifyPaymentAndComplete = asyncHandler(async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      type, // 'course', 'product', or 'school_product'
      itemId, // courseId, productId, or schoolProductId
      quantity = 1,
      billingAddress
    } = req.body;

    const userId = req.user._id;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !type || !itemId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment verification fields'
      });
    }

    // Verify payment signature
    const isVerified = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    
    if (!isVerified) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed'
      });
    }

    // Fetch payment details from Razorpay to confirm status
    const paymentDetails = await fetchPayment(razorpay_payment_id);
    
    if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
      return res.status(400).json({
        success: false,
        error: `Payment status is ${paymentDetails.status}, expected captured or authorized`
      });
    }

    let result = {};

    // Handle different types of purchases
    switch (type) {
      case 'course':
        const course = await Course.findById(itemId);
        if (!course) {
          return res.status(404).json({
            success: false,
            error: 'Course not found'
          });
        }

        // Check if already purchased
        const existingOrder = await Order.findOne({
          userId,
          'items.courseId': itemId,
          paymentStatus: 'paid'
        });

        if (existingOrder) {
          return res.status(400).json({
            success: false,
            error: 'Course already purchased'
          });
        }

        // Create order record
        const courseOrder = await Order.create({
          userId,
          userModel: req.user.role === 'student' ? 'Student' : req.user.role === 'parent' ? 'Parent' : 'User',
          items: [{
            courseId: course._id,
            type: 'course',
            name: course.name,
            price: course.price,
            quantity: 1,
            subtotal: course.price
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
            subtotal: course.price,
            discount: 0,
            paymentFee: 0,
            total: course.price
          },
          status: 'completed',
          paymentStatus: 'paid',
          transactionId: razorpay_payment_id,
          completedAt: new Date()
        });

        result = {
          type: 'course',
          order: courseOrder,
          course: course
        };
        break;

      case 'product':
        const product = await Product.findById(itemId);
        if (!product) {
          return res.status(404).json({
            success: false,
            error: 'Product not found'
          });
        }

        if (product.stock < quantity) {
          return res.status(400).json({
            success: false,
            error: `Insufficient stock. Only ${product.stock} units available`
          });
        }

        const productTotal = product.price * quantity;

        // Update stock
        await product.updateStock(quantity, 'subtract');
        await product.recordSale(quantity, product.price, billingAddress?.name || req.user.name || 'Unknown');

        // Create order record
        const productOrder = await Order.create({
          userId,
          userModel: req.user.role === 'student' ? 'Student' : req.user.role === 'parent' ? 'Parent' : 'User',
          items: [{
            productId: product._id,
            type: 'product',
            name: product.name,
            price: product.price,
            quantity: quantity,
            subtotal: productTotal
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
            subtotal: productTotal,
            discount: 0,
            paymentFee: 0,
            total: productTotal
          },
          status: 'completed',
          paymentStatus: 'paid',
          transactionId: razorpay_payment_id,
          completedAt: new Date()
        });

        result = {
          type: 'product',
          order: productOrder,
          product: product
        };
        break;

      case 'school_product':
        const schoolProduct = await SchoolProduct.findById(itemId);
        if (!schoolProduct) {
          return res.status(404).json({
            success: false,
            error: 'School product not found'
          });
        }

        if (schoolProduct.stock < quantity) {
          return res.status(400).json({
            success: false,
            error: `Insufficient stock. Only ${schoolProduct.stock} units available`
          });
        }

        const School = require('../models/School');
        const school = await School.findById(req.user.schoolId);
        if (!school) {
          return res.status(400).json({
            success: false,
            error: 'School not found'
          });
        }

        const unitPrice = schoolProduct.getBulkPrice(quantity);
        const schoolProductTotal = unitPrice * quantity;

        // Record purchase
        await schoolProduct.recordPurchase(
          school._id,
          school.name,
          quantity,
          unitPrice
        );

        result = {
          type: 'school_product',
          purchase: {
            productId: schoolProduct._id,
            productName: schoolProduct.name,
            quantity: quantity,
            unitPrice: unitPrice,
            totalAmount: schoolProductTotal,
            transactionId: razorpay_payment_id
          },
          product: schoolProduct
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid purchase type'
        });
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified and purchase completed successfully',
      data: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        ...result
      }
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify payment'
    });
  }
});

module.exports = {
  createCoursePayment,
  createProductPayment,
  createSchoolProductPayment,
  verifyPaymentAndComplete
};

