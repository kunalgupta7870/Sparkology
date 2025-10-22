const Order = require('../models/Order');
const Product = require('../models/Product');
const Course = require('../models/Course');
const Cart = require('../models/Cart');
const PromoCode = require('../models/PromoCode');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Create new order (Purchase)
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
  try {
    const {
      items,
      billingAddress,
      paymentMethod,
      promoCode,
      discount,
      total,
      transactionId
    } = req.body;

    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : 
                     req.user.role === 'parent' ? 'Parent' : 'User';

    console.log('📦 Creating order for user:', userId);
    console.log('📦 User model:', userModel);
    console.log('📦 Order items:', items?.length || 0);
    console.log('📦 Items data:', JSON.stringify(items, null, 2));
    console.log('📦 Billing address:', billingAddress);
    console.log('📦 Promo code:', promoCode);

    // Validate items
    if (!items || items.length === 0) {
      console.log('❌ No items in order');
      return res.status(400).json({
        success: false,
        error: 'No items in order'
      });
    }

    // Validate billing address
    if (!billingAddress || !billingAddress.name || !billingAddress.email) {
      console.log('❌ Invalid billing address');
      return res.status(400).json({
        success: false,
        error: 'Billing address with name and email is required'
      });
    }

    // Process each item and validate stock
    const processedItems = [];
    let subtotal = 0;

    for (const item of items) {
      console.log('📦 Processing item:', item.name, 'Type:', item.type);
      
      if (item.type === 'product' && item.productId) {
        console.log('📦 Looking for product with ID:', item.productId);
        
        // Validate product and stock
        const product = await Product.findById(item.productId);
        
        if (!product) {
          console.log('❌ Product not found:', item.productId);
          return res.status(404).json({
            success: false,
            error: `Product not found: ${item.name}`
          });
        }
        
        console.log('✅ Product found:', product.name, 'Stock:', product.stock);

        if (product.status !== 'active') {
          return res.status(400).json({
            success: false,
            error: `Product not available: ${product.name}`
          });
        }

        const quantity = item.quantity || 1;
        if (product.stock < quantity) {
          return res.status(400).json({
            success: false,
            error: `Insufficient stock for ${product.name}. Only ${product.stock} available`
          });
        }

        const itemSubtotal = product.price * quantity;
        subtotal += itemSubtotal;

        processedItems.push({
          productId: product._id,
          type: 'product',
          name: product.name,
          price: product.price,
          quantity: quantity,
          image: product.images && product.images.length > 0 ? 
                 (product.images.find(img => img.isPrimary)?.url || product.images[0].url) : null,
          category: product.category,
          subtotal: itemSubtotal
        });

        // Update product stock
        await product.updateStock(quantity, 'subtract');
        
        // Record sale
        await product.recordSale(quantity, product.price, billingAddress.name);
        
        console.log(`✅ Updated stock for ${product.name}: ${product.stock} remaining`);
      } else if (item.type === 'course' && item.courseId) {
        const course = await Course.findById(item.courseId || item.id);
        if (!course) {
          return res.status(404).json({
            success: false,
            error: `Course not found: ${item.name}`
          });
        }

        const itemSubtotal = course.price;
        subtotal += itemSubtotal;

        processedItems.push({
          courseId: course._id,
          type: 'course',
          name: course.name,
          price: course.price,
          quantity: 1,
          image: course.thumbnail,
          category: course.category,
          subtotal: itemSubtotal
        });
      }
    }

    // Calculate final pricing
    const discountAmount = parseFloat(discount) || 0;
    const finalTotal = parseFloat(total) || (subtotal - discountAmount);

    // Prepare promo code data if applied
    let promoCodeData = null;
    if (promoCode && promoCode.code) {
      promoCodeData = {
        code: promoCode.code,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        discountAmount: discountAmount
      };

      // Update promo code usage (will be updated after order is created)
    }

    // Create order
    const order = await Order.create({
      userId,
      userModel,
      items: processedItems,
      billingAddress: {
        name: billingAddress.name,
        email: billingAddress.email,
        phone: billingAddress.phone || '',
        address: billingAddress.address || ''
      },
      paymentMethod: {
        type: paymentMethod?.type || 'card',
        name: paymentMethod?.name || 'Card Payment'
      },
      promoCode: promoCodeData,
      pricing: {
        subtotal: subtotal,
        discount: discountAmount,
        paymentFee: 0,
        total: finalTotal
      },
      status: 'completed',
      paymentStatus: 'paid',
      transactionId: transactionId || `TXN-${Date.now()}`,
      completedAt: new Date()
    });

    console.log('✅ Order created:', order.orderNumber);

    // Update promo code usage if applied
    if (promoCode && promoCode._id) {
      try {
        const promoCodeDoc = await PromoCode.findById(promoCode._id);
        if (promoCodeDoc) {
          await promoCodeDoc.recordUsage(
            userId,
            order._id,
            processedItems[0]?.productId || processedItems[0]?.courseId,
            subtotal,
            discountAmount
          );
          console.log('✅ Promo code usage recorded');
        }
      } catch (promoError) {
        console.error('Error updating promo code:', promoError);
        // Don't fail the order if promo update fails
      }
    }

    // Clear cart after successful order
    try {
      const cart = await Cart.findOne({ userId, userModel });
      if (cart) {
        cart.clearCart();
        await cart.save();
        console.log('✅ Cart cleared after purchase');
      }
    } catch (cartError) {
      console.error('Error clearing cart:', cartError);
      // Don't fail the order if cart clearing fails
    }

    // Populate order before sending
    await order.populate('items.productId', 'name price images category');
    await order.populate('items.courseId', 'name price thumbnail category instructor');

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create order'
    });
  }
});

// @desc    Get user's orders
// @route   GET /api/orders
// @access  Private
const getOrders = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : 
                     req.user.role === 'parent' ? 'Parent' : 'User';
    const { status, page = 1, limit = 20 } = req.query;

    let filters = {};
    if (status) {
      filters.status = status;
    }

    const orders = await Order.getOrdersByUser(userId, userModel, filters)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Order.countDocuments({ userId, userModel, ...filters });

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get orders'
    });
  }
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrder = asyncHandler(async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.productId', 'name price images category')
      .populate('items.courseId', 'name price thumbnail category instructor');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order'
    });
  }
});

// @desc    Get order by order number
// @route   GET /api/orders/number/:orderNumber
// @access  Private
const getOrderByNumber = asyncHandler(async (req, res) => {
  try {
    const order = await Order.getOrderByNumber(req.params.orderNumber);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order by number error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order'
    });
  }
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrder = asyncHandler(async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check if order can be cancelled
    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Order cannot be cancelled'
      });
    }

    await order.cancelOrder(reason);

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order'
    });
  }
});

// @desc    Get all orders (Admin only)
// @route   GET /api/orders/all
// @access  Private (Admin)
const getAllOrders = asyncHandler(async (req, res) => {
  try {
    const { status, page = 1, limit = 100, startDate, endDate } = req.query;

    let filters = {};
    if (status) {
      filters.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) {
        filters.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filters.createdAt.$lte = new Date(endDate);
      }
    }

    const orders = await Order.find(filters)
      .populate('items.productId', 'name price images category')
      .populate('items.courseId', 'name price thumbnail category instructor')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Order.countDocuments(filters);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get orders'
    });
  }
});

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  getOrderByNumber,
  cancelOrder,
  getAllOrders
};

