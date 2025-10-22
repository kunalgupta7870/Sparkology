const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Course = require('../models/Course');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : 
                     req.user.role === 'parent' ? 'Parent' : 'User';

    let cart = await Cart.findOne({ userId, userModel })
      .populate({
        path: 'items.productId',
        select: 'name price images category stock status',
        options: { virtuals: false }
      })
      .populate({
        path: 'items.courseId',
        select: 'name price thumbnail category instructor',
        options: { virtuals: false }
      })
      .lean();

    if (!cart) {
      // Create empty cart if doesn't exist and return it
      const newCart = await Cart.create({ 
        userId, 
        userModel, 
        items: [],
        totalItems: 0,
        totalPrice: 0
      });
      
      return res.status(200).json({
        success: true,
        data: {
          _id: newCart._id,
          userId: newCart.userId,
          userModel: newCart.userModel,
          items: [],
          totalItems: 0,
          totalPrice: 0
        }
      });
    }

    // Ensure items array exists
    if (!cart.items) {
      cart.items = [];
    }

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get cart'
    });
  }
});

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
const addToCart = asyncHandler(async (req, res) => {
  try {
    const { productId, courseId, type = 'product', quantity = 1 } = req.body;
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : 
                     req.user.role === 'parent' ? 'Parent' : 'User';

    // Validate input
    if (!type || (type === 'product' && !productId) || (type === 'course' && !courseId)) {
      return res.status(400).json({
        success: false,
        error: 'Product ID or Course ID is required'
      });
    }

    // Get or create cart
    let cart = await Cart.createOrGetCart(userId, userModel);

    // Get item details
    let itemData = {};
    if (type === 'product' && productId) {
      const product = await Product.findById(productId);
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
          error: 'Product is not available'
        });
      }

      // Check stock
      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock. Only ${product.stock} units available`
        });
      }

      itemData = {
        productId: product._id,
        type: 'product',
        name: product.name,
        price: product.price,
        quantity,
        image: product.images && product.images.length > 0 ? 
               (product.images.find(img => img.isPrimary)?.url || product.images[0].url) : null,
        category: product.category,
        description: product.description
      };
    } else if (type === 'course' && courseId) {
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          error: 'Course not found'
        });
      }

      itemData = {
        courseId: course._id,
        type: 'course',
        name: course.name,
        price: course.price,
        quantity: 1, // Courses always have quantity of 1
        image: course.thumbnail || null,
        category: course.category,
        description: course.description
      };
    }

    // Add item to cart
    cart.addItem(itemData);
    await cart.save();

    // Populate cart before sending response (without virtuals to avoid errors)
    const populatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.productId',
        select: 'name price images category stock status',
        options: { virtuals: false }
      })
      .populate({
        path: 'items.courseId',
        select: 'name price thumbnail category instructor',
        options: { virtuals: false }
      })
      .lean();

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: populatedCart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add item to cart'
    });
  }
});

// @desc    Update item quantity
// @route   PUT /api/cart/update-quantity/:itemId
// @access  Private
const updateQuantity = asyncHandler(async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : 
                     req.user.role === 'parent' ? 'Parent' : 'User';

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid quantity is required'
      });
    }

    const cart = await Cart.findOne({ userId, userModel });
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    // Check if it's a product and validate stock
    const item = cart.items.id(itemId);
    if (item && item.type === 'product' && item.productId) {
      const product = await Product.findById(item.productId);
      if (product && quantity > product.stock) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock. Only ${product.stock} units available`
        });
      }
    }

    cart.updateQuantity(itemId, quantity);
    await cart.save();

    // Populate cart before sending response (without virtuals to avoid errors)
    const populatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.productId',
        select: 'name price images category stock status',
        options: { virtuals: false }
      })
      .populate({
        path: 'items.courseId',
        select: 'name price thumbnail category instructor',
        options: { virtuals: false }
      })
      .lean();

    res.status(200).json({
      success: true,
      message: quantity === 0 ? 'Item removed from cart' : 'Quantity updated',
      data: populatedCart
    });
  } catch (error) {
    console.error('Update quantity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update quantity'
    });
  }
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove/:itemId
// @access  Private
const removeFromCart = asyncHandler(async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : 
                     req.user.role === 'parent' ? 'Parent' : 'User';

    const cart = await Cart.findOne({ userId, userModel });
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.removeItem(itemId);
    await cart.save();

    // Populate cart before sending response (without virtuals to avoid errors)
    const populatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.productId',
        select: 'name price images category stock status',
        options: { virtuals: false }
      })
      .populate({
        path: 'items.courseId',
        select: 'name price thumbnail category instructor',
        options: { virtuals: false }
      })
      .lean();

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: populatedCart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove item from cart'
    });
  }
});

// @desc    Toggle item selection
// @route   PUT /api/cart/toggle-selection/:itemId
// @access  Private
const toggleItemSelection = asyncHandler(async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : 
                     req.user.role === 'parent' ? 'Parent' : 'User';

    const cart = await Cart.findOne({ userId, userModel });
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.toggleItemSelection(itemId);
    await cart.save();

    // Populate cart before sending response (without virtuals to avoid errors)
    const populatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.productId',
        select: 'name price images category stock status',
        options: { virtuals: false }
      })
      .populate({
        path: 'items.courseId',
        select: 'name price thumbnail category instructor',
        options: { virtuals: false }
      })
      .lean();

    res.status(200).json({
      success: true,
      message: 'Item selection toggled',
      data: populatedCart
    });
  } catch (error) {
    console.error('Toggle selection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle item selection'
    });
  }
});

// @desc    Clear cart (all items)
// @route   DELETE /api/cart/clear
// @access  Private
const clearCart = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : 
                     req.user.role === 'parent' ? 'Parent' : 'User';

    const cart = await Cart.findOne({ userId, userModel });
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.clearCart();
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared',
      data: cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cart'
    });
  }
});

// @desc    Clear selected items from cart
// @route   DELETE /api/cart/clear-selected
// @access  Private
const clearSelectedItems = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : 
                     req.user.role === 'parent' ? 'Parent' : 'User';

    const cart = await Cart.findOne({ userId, userModel });
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.clearSelectedItems();
    await cart.save();

    // Populate cart before sending response (without virtuals to avoid errors)
    const populatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.productId',
        select: 'name price images category stock status',
        options: { virtuals: false }
      })
      .populate({
        path: 'items.courseId',
        select: 'name price thumbnail category instructor',
        options: { virtuals: false }
      })
      .lean();

    res.status(200).json({
      success: true,
      message: 'Selected items cleared from cart',
      data: populatedCart
    });
  } catch (error) {
    console.error('Clear selected items error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear selected items'
    });
  }
});

// @desc    Get cart summary
// @route   GET /api/cart/summary
// @access  Private
const getCartSummary = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : 
                     req.user.role === 'parent' ? 'Parent' : 'User';

    const cart = await Cart.findOne({ userId, userModel });
    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          totalItems: 0,
          totalPrice: 0,
          selectedItemsCount: 0,
          selectedItemsTotal: 0
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice,
        selectedItemsCount: cart.selectedItemsCount,
        selectedItemsTotal: cart.selectedItemsTotal
      }
    });
  } catch (error) {
    console.error('Get cart summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cart summary'
    });
  }
});

module.exports = {
  getCart,
  addToCart,
  updateQuantity,
  removeFromCart,
  toggleItemSelection,
  clearCart,
  clearSelectedItems,
  getCartSummary
};

